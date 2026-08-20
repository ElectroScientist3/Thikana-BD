const express = require('express');
const mongoose = require('mongoose');
const Listing = require('../models/Listing');
const User = require('../models/User');
const RentalAgreement = require('../models/RentalAgreement');
const RentLedgerEntry = require('../models/RentLedgerEntry');
const RentPaymentRequest = require('../models/RentPaymentRequest');
const MaintenanceIssue = require('../models/MaintenanceIssue');
const MoveOutRequest = require('../models/MoveOutRequest');
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_SERVICE_CHARGE = 2500;
const DEFAULT_UTILITIES = 1000;
const numberOr = (value, fallback = 0) => {
  const number = typeof value === 'string' ? Number(value.replace(/,/g, '').trim()) : Number(value);
  return Number.isFinite(number) ? number : fallback;
};

const periodFor = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const periodLabel = (period) => {
  if (typeof period !== 'string' || !/^\d{4}-\d{2}$/.test(period)) return 'Current rental';
  const [year, month] = period.split('-').map(Number);
  if (!year || month < 1 || month > 12) return 'Current rental';
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};
const calculateStatus = (paidAmount, totalDue, dueDate) => {
  if (paidAmount >= totalDue) return 'Paid';
  if (paidAmount > 0) return 'Partially Paid';
  return new Date(dueDate) < new Date() ? 'Overdue' : 'Unpaid';
};
const dueDateFor = (agreement, year, month) => {
  const day = agreement.dueDate ? new Date(agreement.dueDate).getDate() : 15;
  return new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate()));
};

const paidAmountFromHistory = (entry) => (entry.paymentHistory || [])
  .filter((payment) => payment.status === 'Completed')
  .reduce((total, payment) => total + numberOr(payment.amount), 0);

async function reconcilePaidAmount(entry) {
  const historyPaidAmount = paidAmountFromHistory(entry);
  const paidAmount = Math.min(
    Math.max(numberOr(entry.paidAmount), historyPaidAmount),
    numberOr(entry.totalDue),
  );
  const status = calculateStatus(paidAmount, numberOr(entry.totalDue), entry.dueDate);
  if (entry.paidAmount !== paidAmount || entry.status !== status) {
    entry.paidAmount = paidAmount;
    entry.status = status;
    await entry.save();
  }
  return entry;
}

async function ensureEntry(agreement, listing, period = periodFor()) {
  const [year, month] = period.split('-').map(Number);
  const serviceCharge = numberOr(listing.service_charge_bdt, DEFAULT_SERVICE_CHARGE);
  const utilities = numberOr(listing.utilities_charge_bdt, DEFAULT_UTILITIES);
  if (listing.service_charge_bdt == null || listing.utilities_charge_bdt == null) {
    await Listing.updateOne(
      { _id: listing._id },
      {
        $set: {
          service_charge_bdt: listing.service_charge_bdt ?? DEFAULT_SERVICE_CHARGE,
          utilities_charge_bdt: listing.utilities_charge_bdt ?? DEFAULT_UTILITIES,
        },
      },
    );
  }
  const rent = numberOr(listing.monthly_rent_bdt ?? agreement.monthlyRent, 0);
  const dueDate = dueDateFor(agreement, year, month);
  const totalDue = rent + serviceCharge + utilities;
  const entry = await RentLedgerEntry.findOneAndUpdate(
    { agreement: agreement._id, period },
    {
      $setOnInsert: {
        agreement: agreement._id,
        listing: listing._id,
        tenant: agreement.tenant,
        owner: agreement.owner,
        period,
        paidAmount: 0,
        note: 'Monthly rent ledger entry',
      },
      $set: { rent, serviceCharge, utilities, totalDue, dueDate },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return reconcilePaidAmount(entry);
}

async function getAgreements(query) {
  const agreements = await RentalAgreement.find({ ...query, status: 'Active' }).lean();
  return [...new Map(
    agreements
      .sort((left, right) => new Date(right.generatedAt || right.startDate || 0) - new Date(left.generatedAt || left.startDate || 0))
      .map((agreement) => [String(agreement.listing), agreement]),
  ).values()];
}

async function getRentedListings(query) {
  return Listing.find({ ...query, status: 'rented' })
    .select('title area city monthly_rent_bdt service_charge_bdt utilities_charge_bdt utilities rented_to_user_id rented_at owner_id owner_name owner_email')
    .lean();
}

const utilityResponsibilitiesFor = (utilities = {}) => Object.entries(utilities || {})
  .filter(([, value]) => value)
  .map(([key]) => key === 'electricity' ? 'Electricity' : key.charAt(0).toUpperCase() + key.slice(1));

const agreementInfoForListing = (listing, dueDate = 15) => {
  const safeListing = listing || {};
  return {
  propertyAddress: [safeListing.title, safeListing.area, safeListing.city].filter(Boolean).join(', '),
  dueDate,
  serviceCharge: numberOr(safeListing.service_charge_bdt, DEFAULT_SERVICE_CHARGE),
  utilitiesCharge: numberOr(safeListing.utilities_charge_bdt, DEFAULT_UTILITIES),
  utilities: {
    tenantResponsibilities: utilityResponsibilitiesFor(safeListing.utilities),
    ownerResponsibilities: [],
  },
  };
};

async function getEntriesForAgreements(agreements, period) {
  const entries = [];
  for (const agreement of agreements) {
    const listing = await Listing.findById(agreement.listing).lean();
    if (listing) entries.push(await ensureEntry(agreement, listing, period));
  }
  return entries;
}

const entryView = (entry, listingsById, usersById) => ({
  ...entry,
  periodLabel: periodLabel(entry.period),
  remainingAmount: Math.max(entry.totalDue - entry.paidAmount, 0),
  listing: listingsById[String(entry.listing)] || null,
  tenantInfo: usersById[String(entry.tenant)] || null,
  ownerInfo: usersById[String(entry.owner)] || null,
});

async function hydrateEntries(entries) {
  const validEntries = entries.filter((entry) => (
    mongoose.isValidObjectId(entry.listing)
    && mongoose.isValidObjectId(entry.tenant)
    && mongoose.isValidObjectId(entry.owner)
  ));
  const listingIds = [...new Set(validEntries.map((entry) => String(entry.listing)))];
  const userIds = [...new Set(validEntries.flatMap((entry) => [String(entry.tenant), String(entry.owner)]))];
  const agreementIds = [...new Set(validEntries.map((entry) => entry.agreement && String(entry.agreement)).filter(Boolean))];
  const [listings, users, agreements] = await Promise.all([
    Listing.find({ _id: { $in: listingIds } }).select('title area city monthly_rent_bdt service_charge_bdt utilities_charge_bdt utilities').lean(),
    User.find({ _id: { $in: userIds } }).select('name email phone').lean(),
    RentalAgreement.find({ _id: { $in: agreementIds } }).select('propertyAddress serviceCharge utilitiesCharge dueDate leaseDuration utilities').lean(),
  ]);
  const listingsById = Object.fromEntries(listings.map((listing) => [String(listing._id), listing]));
  const usersById = Object.fromEntries(users.map((user) => [String(user._id), user]));
  const agreementsById = Object.fromEntries(agreements.map((agreement) => [String(agreement._id), agreement]));
  return validEntries.map((entry) => {
    const listing = listingsById[String(entry.listing)] || null;
    const agreementInfo = agreementsById[String(entry.agreement)] || null;
    const rent = numberOr(entry.rent, numberOr(listing?.monthly_rent_bdt ?? agreementInfo?.monthlyRent, 0));
    const serviceCharge = numberOr(entry.serviceCharge, numberOr(agreementInfo?.serviceCharge ?? listing?.service_charge_bdt, DEFAULT_SERVICE_CHARGE));
    const utilities = numberOr(entry.utilities, numberOr(agreementInfo?.utilitiesCharge ?? listing?.utilities_charge_bdt, DEFAULT_UTILITIES));
    const totalDue = rent + serviceCharge + utilities;
    const paidAmount = numberOr(entry.paidAmount, 0);
    return {
      ...entryView({ ...entry, rent, serviceCharge, utilities, totalDue, paidAmount }, listingsById, usersById),
      agreementInfo,
    };
  });
}

function yearlySummary(entries) {
  const summary = {};
  entries.forEach((entry) => {
    if (typeof entry.period !== 'string' || !/^\d{4}-\d{2}$/.test(entry.period)) return;
    const year = entry.period.slice(0, 4);
    summary[year] ||= { year, totalDue: 0, totalPaid: 0, totalRemaining: 0 };
    summary[year].totalDue += entry.totalDue;
    summary[year].totalPaid += entry.paidAmount;
    summary[year].totalRemaining += Math.max(entry.totalDue - entry.paidAmount, 0);
  });
  return Object.values(summary).sort((a, b) => b.year.localeCompare(a.year)).map((item) => ({
    ...item,
    status: item.totalRemaining === 0 ? 'Completed' : 'Active',
  }));
}

router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const agreements = await getAgreements({ tenant: req.userId });
    const entries = await getEntriesForAgreements(agreements, periodFor());
    const allEntries = await RentLedgerEntry.find({ tenant: req.userId }).sort({ period: -1 }).lean();
    const rentedListings = await getRentedListings({ rented_to_user_id: req.userId });
    const activeAgreementIds = new Set(agreements.map((agreement) => String(agreement._id)));
    const activeAgreementListings = new Map(agreements.map((agreement) => [
      String(agreement._id),
      String(agreement.listing),
    ]));
    const currentIds = new Set(entries.map((entry) => String(entry._id)));
    const activeEntries = allEntries.filter((entry) => (
      activeAgreementIds.has(String(entry.agreement))
      && activeAgreementListings.get(String(entry.agreement)) === String(entry.listing)
    ));
    const previousEntries = allEntries.filter((entry) => (
      !activeAgreementIds.has(String(entry.agreement))
      || activeAgreementListings.get(String(entry.agreement)) !== String(entry.listing)
    ));
    const requests = await RentPaymentRequest.find({ tenant: req.userId }).sort({ createdAt: -1 }).lean();
    const maintenanceIssues = await MaintenanceIssue.find({ tenant: req.userId })
      .populate('listing', 'title area city')
      .sort({ createdAt: -1 })
      .lean();
    const moveOutRequests = await MoveOutRequest.find({ tenant: req.userId })
      .populate('listing', 'title area city')
      .sort({ createdAt: -1 })
      .lean();
    const hydratedEntries = await hydrateEntries([
      ...entries,
      ...activeEntries.filter((entry) => !currentIds.has(String(entry._id))),
    ]);
    const previousHistory = await hydrateEntries(previousEntries);
    const ownerIds = [...new Set(rentedListings.map((listing) => listing.owner_id && String(listing.owner_id)).filter(Boolean))];
    const owners = await User.find({ _id: { $in: ownerIds } }).select('name email phone').lean();
    const ownersById = Object.fromEntries(owners.map((owner) => [String(owner._id), owner]));
    const listedEntryIds = new Set(hydratedEntries.map((entry) => String(entry.listing?._id || entry.listing)));
    const rentedProperties = rentedListings
      .filter((listing) => !listedEntryIds.has(String(listing._id)))
      .map((listing) => ({
        ...listing,
        monthlyRent: Number(listing.monthly_rent_bdt || 0),
        serviceCharge: Number(listing.service_charge_bdt ?? DEFAULT_SERVICE_CHARGE),
        utilitiesCharge: Number(listing.utilities_charge_bdt ?? DEFAULT_UTILITIES),
        dueDate: 15,
        propertyAddress: [listing.title, listing.area, listing.city].filter(Boolean).join(', '),
        ownerInfo: ownersById[String(listing.owner_id)] || {
          name: listing.owner_name,
          email: listing.owner_email,
        },
        tenantInfo: { _id: req.userId },
        agreementInfo: agreementInfoForListing(listing),
      }));
    res.json({
      entries: hydratedEntries,
      previousHistory,
      rentedProperties,
      yearlySummary: yearlySummary(allEntries),
      requests,
      maintenanceIssues,
      moveOutRequests,
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/owner', authMiddleware, async (req, res) => {
  try {
    const agreements = await getAgreements({ owner: req.userId });
    const entries = await getEntriesForAgreements(agreements, periodFor());
    const rentedListings = await getRentedListings({ owner_id: req.userId });
    const rentedListingIds = new Set(rentedListings.map((listing) => String(listing._id)));
    const allEntries = await RentLedgerEntry.find({ owner: req.userId, period: periodFor() }).lean();
    const activeAgreementIds = new Set(agreements.map((agreement) => String(agreement._id)));
    const activeAgreementListings = new Map(agreements.map((agreement) => [
      String(agreement._id),
      String(agreement.listing),
    ]));
    const currentIds = new Set(entries.map((entry) => String(entry._id)));
    const combined = [
      ...entries.filter((entry) => (
        rentedListingIds.has(String(entry.listing))
        && activeAgreementListings.get(String(entry.agreement)) === String(entry.listing)
      )),
      ...allEntries.filter((entry) => (
        !currentIds.has(String(entry._id))
        && activeAgreementIds.has(String(entry.agreement))
        && activeAgreementListings.get(String(entry.agreement)) === String(entry.listing)
        && rentedListingIds.has(String(entry.listing))
      )),
    ];
    const hydrated = (await hydrateEntries(combined)).filter((entry) => (
      entry.listing && rentedListingIds.has(String(entry.listing._id))
    ));
    const properties = [];
    const byListing = new Map();
    hydrated.forEach((entry) => {
      const key = String(entry.listing?._id || entry.listing);
      if (!byListing.has(key)) {
        byListing.set(key, {
          id: key,
          title: entry.listing?.title || 'Property',
          location: [entry.listing?.city, entry.listing?.area].filter(Boolean).join(', '),
          propertyAddress: entry.agreementInfo?.propertyAddress || [entry.listing?.title, entry.listing?.area, entry.listing?.city].filter(Boolean).join(', '),
          monthlyRent: entry.rent,
          serviceCharge: entry.serviceCharge,
          utilities: entry.utilities,
          utilityResponsibilities: entry.agreementInfo?.utilities || agreementInfoForListing(entry.listing).utilities,
          dueDate: entry.dueDate,
          currentMonthDue: 0,
          paidThisMonth: 0,
          remainingThisMonth: 0,
          tenants: [],
        });
        properties.push(byListing.get(key));
      }
      const property = byListing.get(key);
      property.currentMonthDue += entry.totalDue;
      property.paidThisMonth += entry.paidAmount;
      property.remainingThisMonth += Math.max(entry.totalDue - entry.paidAmount, 0);
      property.tenants.push({
        id: String(entry.tenant),
        name: entry.tenantInfo?.name || 'Tenant',
        email: entry.tenantInfo?.email,
        phone: entry.tenantInfo?.phone,
        unit: entry.listing?.area || '-',
        status: entry.status,
        dueDate: entry.dueDate,
        totalDue: entry.totalDue,
        paidThisMonth: entry.paidAmount,
        remainingAmount: Math.max(entry.totalDue - entry.paidAmount, 0),
        paymentHistory: entry.paymentHistory || [],
        ledgerEntryId: entry._id,
      });
    });
    const representedListingIds = new Set(properties.map((property) => property.id));
    const rentedTenantIds = [...new Set(rentedListings.map((listing) => listing.rented_to_user_id && String(listing.rented_to_user_id)).filter(Boolean))];
    const rentedTenants = await User.find({ _id: { $in: rentedTenantIds } }).select('name email phone').lean();
    const tenantsById = Object.fromEntries(rentedTenants.map((tenant) => [String(tenant._id), tenant]));
    rentedListings
      .filter((listing) => (
        !representedListingIds.has(String(listing._id))
        && mongoose.isValidObjectId(listing.rented_to_user_id)
      ))
      .forEach((listing) => {
      const serviceCharge = numberOr(listing.service_charge_bdt, DEFAULT_SERVICE_CHARGE);
      const utilities = numberOr(listing.utilities_charge_bdt, DEFAULT_UTILITIES);
      const rent = numberOr(listing.monthly_rent_bdt, 0);
      const tenant = tenantsById[String(listing.rented_to_user_id)];
      const agreementInfo = agreementInfoForListing(listing);
      properties.push({
        id: String(listing._id),
        title: listing.title || 'Property',
        location: [listing.city, listing.area].filter(Boolean).join(', '),
        propertyAddress: [listing.title, listing.area, listing.city].filter(Boolean).join(', '),
        utilityResponsibilities: agreementInfo.utilities,
        ownerInfo: { name: listing.owner_name, email: listing.owner_email },
        tenantInfo: tenant || null,
        monthlyRent: rent,
        serviceCharge,
        utilities,
        dueDate: 15,
        currentMonthDue: rent + serviceCharge + utilities,
        paidThisMonth: 0,
        remainingThisMonth: rent + serviceCharge + utilities,
        status: 'Unpaid',
        tenants: [{
          id: String(listing.rented_to_user_id),
          name: tenant?.name || 'Tenant',
          email: tenant?.email,
          phone: tenant?.phone,
          unit: listing.area || '-',
          status: 'Unpaid',
          dueDate: 15,
          totalDue: rent + serviceCharge + utilities,
          paidThisMonth: 0,
          remainingAmount: rent + serviceCharge + utilities,
          paymentHistory: [],
          email: tenant?.email,
          phone: tenant?.phone,
        }],
      });
    });
    const uniqueProperties = [...new Map(properties.map((property) => [property.id, property])).values()];
    uniqueProperties.forEach((property) => {
      property.status = property.remainingThisMonth === 0 ? 'Paid' : property.paidThisMonth ? 'Partially Paid' : 'Unpaid';
      property.maintenanceIssues = [];
      property.moveOutRequests = [];
    });
    const requests = await RentPaymentRequest.find({ owner: req.userId }).populate('tenant', 'name email').populate('listing', 'title').sort({ createdAt: -1 }).lean();
    const [maintenanceIssues, moveOutRequests] = await Promise.all([
      MaintenanceIssue.find({ owner: req.userId })
        .populate('tenant', 'name email phone')
        .populate('listing', 'title area city')
        .sort({ createdAt: -1 })
        .lean(),
      MoveOutRequest.find({ owner: req.userId })
        .populate('tenant', 'name email phone')
        .populate('listing', 'title area city')
        .sort({ createdAt: -1 })
        .lean(),
    ]);
    const issuesByListing = new Map();
    maintenanceIssues.forEach((issue) => {
      const key = String(issue.listing?._id || issue.listing);
      if (!issuesByListing.has(key)) issuesByListing.set(key, []);
      issuesByListing.get(key).push(issue);
    });
    const moveOutByListing = new Map();
    moveOutRequests.forEach((request) => {
      const key = String(request.listing?._id || request.listing);
      if (!moveOutByListing.has(key)) moveOutByListing.set(key, []);
      moveOutByListing.get(key).push(request);
    });
    uniqueProperties.forEach((property) => {
      property.maintenanceIssues = issuesByListing.get(property.id) || [];
      property.moveOutRequests = moveOutByListing.get(property.id) || [];
    });
    res.json({ properties: uniqueProperties, requests, entries: hydrated, maintenanceIssues, moveOutRequests });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/requests', authMiddleware, async (req, res) => {
  try {
    const { ledgerEntryId, amount } = req.body;
    const entry = await RentLedgerEntry.findOne({ _id: ledgerEntryId, tenant: req.userId });
    if (!entry) return res.status(404).json({ msg: 'Ledger entry not found' });
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0 || numericAmount > Math.max(entry.totalDue - entry.paidAmount, 0)) {
      return res.status(400).json({ msg: 'Amount must be greater than zero and within the remaining balance' });
    }
    const request = await RentPaymentRequest.create({ ledgerEntry: entry._id, listing: entry.listing, tenant: entry.tenant, owner: entry.owner, amount: numericAmount });
    await Notification.create({ user_id: entry.owner, listing_id: entry.listing, type: 'rent_payment_requested', message: 'A tenant submitted a rent payment for approval.', data: { request_id: request._id, ledger_entry_id: entry._id } });
    res.status(201).json({ request });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/requests/:id/approve', authMiddleware, async (req, res) => {
  try {
    const request = await RentPaymentRequest.findOne({ _id: req.params.id, owner: req.userId, status: 'Pending' });
    if (!request) return res.status(404).json({ msg: 'Pending payment request not found' });
    const entry = await RentLedgerEntry.findOne({ _id: request.ledgerEntry, owner: req.userId });
    if (!entry) return res.status(404).json({ msg: 'Ledger entry not found' });
    entry.paidAmount = Math.min(entry.totalDue, entry.paidAmount + request.amount);
    entry.status = calculateStatus(entry.paidAmount, entry.totalDue, entry.dueDate);
    await entry.save();
    request.status = 'Approved';
    request.approvedAt = new Date();
    await request.save();
    await Notification.create({ user_id: request.tenant, listing_id: request.listing, type: 'rent_payment_approved', message: 'Your rent payment was approved by the owner.', data: { request_id: request._id, ledger_entry_id: entry._id } });
    res.json({ request, entry });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/maintenance', authMiddleware, async (req, res) => {
  try {
    const { listingId, category, title, description } = req.body;
    const allowedCategories = ['Water', 'Gas', 'Electrical', 'Lift', 'Leakage', 'Security', 'Internet', 'Other'];
    if (!mongoose.isValidObjectId(listingId)) return res.status(400).json({ msg: 'A valid property is required' });
    if (!allowedCategories.includes(category)) return res.status(400).json({ msg: 'A valid maintenance category is required' });
    if (!String(title || '').trim() || !String(description || '').trim()) {
      return res.status(400).json({ msg: 'Issue title and description are required' });
    }
    const listing = await Listing.findOne({ _id: listingId, status: 'rented', rented_to_user_id: req.userId });
    if (!listing) return res.status(404).json({ msg: 'Active rented property not found' });
    const issue = await MaintenanceIssue.create({
      listing: listing._id,
      tenant: req.userId,
      owner: listing.owner_id,
      category,
      title: String(title).trim(),
      description: String(description).trim(),
    });
    await Notification.create({
      user_id: listing.owner_id,
      listing_id: listing._id,
      type: 'maintenance_issue_submitted',
      message: `A tenant submitted a maintenance issue for ${listing.title}: ${issue.title}.`,
      data: { issue_id: issue._id, listing_id: listing._id },
    });
    res.status(201).json({ issue });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/maintenance/:id/status', authMiddleware, async (req, res) => {
  try {
    const allowedStatuses = ['Submitted', 'Acknowledged', 'In Progress', 'Resolved', 'Closed'];
    const { status } = req.body;
    if (!allowedStatuses.includes(status)) return res.status(400).json({ msg: 'Invalid maintenance status' });
    const issue = await MaintenanceIssue.findOne({ _id: req.params.id, owner: req.userId });
    if (!issue) return res.status(404).json({ msg: 'Maintenance issue not found' });
    issue.status = status;
    issue.statusUpdatedAt = new Date();
    await issue.save();
    await Notification.create({
      user_id: issue.tenant,
      listing_id: issue.listing,
      type: 'maintenance_status_updated',
      message: `Your maintenance issue "${issue.title}" is now ${status}.`,
      data: { issue_id: issue._id, status },
    });
    res.json({ issue });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/move-out', authMiddleware, async (req, res) => {
  try {
    const { listingId, reason, inspectionRequested } = req.body;
    if (!mongoose.isValidObjectId(listingId)) return res.status(400).json({ msg: 'A valid property is required' });
    const listing = await Listing.findOne({ _id: listingId, status: 'rented', rented_to_user_id: req.userId });
    if (!listing) return res.status(404).json({ msg: 'Active rented property not found' });
    const existing = await MoveOutRequest.findOne({ listing: listing._id, tenant: req.userId, status: 'Pending' });
    if (existing) return res.status(409).json({ msg: 'A move-out request is already pending' });
    const request = await MoveOutRequest.create({
      listing: listing._id,
      tenant: req.userId,
      owner: listing.owner_id,
      reason: String(reason || '').trim(),
      inspectionRequested: Boolean(inspectionRequested),
    });
    await Notification.create({
      user_id: listing.owner_id,
      listing_id: listing._id,
      type: 'move_out_requested',
      message: `A tenant requested to move out of ${listing.title}.`,
      data: { request_id: request._id, listing_id: listing._id },
    });
    res.status(201).json({ request });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/move-out/:id/decision', authMiddleware, async (req, res) => {
  try {
    const { decision } = req.body;
    if (!['Accepted', 'Rejected'].includes(decision)) return res.status(400).json({ msg: 'Invalid move-out decision' });
    const request = await MoveOutRequest.findOne({ _id: req.params.id, owner: req.userId, status: 'Pending' });
    if (!request) return res.status(404).json({ msg: 'Pending move-out request not found' });
    const listing = await Listing.findOne({ _id: request.listing, owner_id: req.userId, rented_to_user_id: request.tenant });
    if (!listing) return res.status(404).json({ msg: 'The rented property is no longer assigned to this tenant' });

    if (decision === 'Accepted') {
      const now = new Date();
      listing.status = 'available_now';
      listing.status_updated_at = now;
      listing.available_from = now;
      listing.rented_to_user_id = null;
      listing.rented_at = null;
      listing.status_history.push({ status: 'available_now', changed_at: now, changed_by: req.userId, notes: 'Tenant move-out request accepted' });
      await listing.save();
      await RentalAgreement.updateMany({ listing: listing._id, tenant: request.tenant, owner: req.userId, status: 'Active' }, { $set: { status: 'Terminated' } });
    }
    request.status = decision;
    request.decidedAt = new Date();
    await request.save();
    await Notification.create({
      user_id: request.tenant,
      listing_id: request.listing,
      type: decision === 'Accepted' ? 'move_out_accepted' : 'move_out_rejected',
      message: decision === 'Accepted' ? `Your move-out request for ${listing.title} was accepted.` : `Your move-out request for ${listing.title} was rejected.`,
      data: { request_id: request._id, listing_id: request.listing, status: decision },
    });
    res.json({ request, listing });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/listings/:id/package', authMiddleware, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ msg: 'A valid property must be selected before saving the rent package' });
    }
    const listing = await Listing.findOne({ _id: req.params.id, owner_id: req.userId });
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    const monthlyRent = numberOr(req.body.monthlyRent, NaN);
    const serviceCharge = numberOr(req.body.serviceCharge, NaN);
    const utilities = numberOr(req.body.utilities, NaN);
    if (![monthlyRent, serviceCharge, utilities].every((value) => Number.isFinite(value) && value >= 0)) return res.status(400).json({ msg: 'Invalid rent package values' });
    listing.monthly_rent_bdt = monthlyRent;
    listing.service_charge_bdt = serviceCharge;
    listing.utilities_charge_bdt = utilities;
    await listing.save();
    await RentalAgreement.updateMany({ listing: listing._id, owner: req.userId, status: 'Active' }, { $set: { monthlyRent, serviceCharge, utilitiesCharge: utilities } });
    res.json({ listing });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.post('/record', authMiddleware, async (req, res) => {
  try {
    const { listingId, amount } = req.body;
    if (!mongoose.isValidObjectId(listingId)) {
      return res.status(400).json({ msg: 'A valid property must be selected before recording payment' });
    }
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) return res.status(400).json({ msg: 'Invalid received amount' });
    const listing = await Listing.findOne({ _id: listingId, owner_id: req.userId, status: 'rented' });
    if (!listing) return res.status(404).json({ msg: 'Rented property not found' });
    const agreements = await RentalAgreement.find({ listing: listing._id, owner: req.userId, status: 'Active' });
    if (!agreements.length) return res.status(404).json({ msg: 'No active rental agreement found for this property' });
    const entries = [];
    for (const agreement of agreements) {
      entries.push(await ensureEntry(agreement, listing, periodFor()));
    }
    const remainingBalance = entries.reduce((total, entry) => total + Math.max(entry.totalDue - entry.paidAmount, 0), 0);
    if (numericAmount > remainingBalance) {
      return res.status(400).json({ msg: `Received amount cannot exceed the remaining balance of ${remainingBalance}` });
    }
    if (!entries.length) return res.status(404).json({ msg: 'No current ledger entries found for this property' });
    let remaining = numericAmount;
    for (const entry of entries) {
      if (remaining <= 0) break;
      const allocation = Math.min(remaining, Math.max(entry.totalDue - entry.paidAmount, 0));
      entry.paidAmount += allocation;
      entry.status = calculateStatus(entry.paidAmount, entry.totalDue, entry.dueDate);
      if (allocation > 0) {
        entry.paymentHistory.push({ amount: allocation, paidAt: new Date(), status: 'Completed' });
      }
      await entry.save();
      remaining -= allocation;
    }
    res.json({ entries: await hydrateEntries(entries) });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
