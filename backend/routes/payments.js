const path = require('path');
const express = require('express');
const router = express.Router();
const axios = require('axios');
const mongoose = require('mongoose');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Listing = require('../models/Listing');
const RentalAgreement = require('../models/RentalAgreement');
const RentLedgerEntry = require('../models/RentLedgerEntry');
const Notification = require('../models/Notification');
const jwt = require('jsonwebtoken');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  if (!token) return res.status(401).json({ msg: 'No token provided' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

const getFrontendUrl = () => process.env.FRONTEND_URL || 'http://localhost:5173';
const getBackendUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const getValidationUrl = (valId) => {
  const storeId = process.env.SSLC_STORE_ID || 'thika6a7348e57eb32';
  const storePassword = process.env.SSLC_STORE_PASSWORD || 'thika6a7348e57eb32@ssl';
  const validationBase = process.env.SSLC_VALIDATION_URL || 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php';
  return `${validationBase}?val_id=${encodeURIComponent(valId)}&store_id=${encodeURIComponent(storeId)}&store_passwd=${encodeURIComponent(storePassword)}&v=1&format=json`;
};

const extractGatewayPageUrl = (data) => {
  if (!data) return null;

  if (typeof data === 'string') {
    try {
      const parsed = JSON.parse(data);
      return extractGatewayPageUrl(parsed);
    } catch (e) {
      // Fall back to raw string parsing below
    }

    const jsonMatch = data.match(/['"]GatewayPageURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]gatewayPageURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]GatewayPageUrl['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]redirectGatewayURL['"]\s*:\s*['"]([^'"]+)['"]/i)
      || data.match(/['"]redirect_url['"]\s*:\s*['"]([^'"]+)['"]/i);
    if (jsonMatch) return jsonMatch[1];

    const formMatch = data.match(/<form[^>]+action=['"]([^'"]+)['"]/i);
    if (formMatch) return formMatch[1];

    const windowMatch = data.match(/window\.location(?:\.href)?\s*=\s*['"]([^'"]+)['"]/i);
    if (windowMatch) return windowMatch[1];

    const anchorMatch = data.match(/href=['"]([^'"]+sslcommerz[^'"]+)['"]/i);
    if (anchorMatch) return anchorMatch[1];
  }

  if (typeof data === 'object' && data !== null) {
    return (
      data.GatewayPageURL ||
      data.gatewayPageURL ||
      data.GatewayPageUrl ||
      data.redirectGatewayURL ||
      data.redirect_url ||
      null
    );
  }

  return null;
};

const isLegacySSLCResponse = (data) => {
  if (typeof data !== 'string') return false;
  return /OLD API|EXPIRED|developer\.sslcommerz\.com|404 Not Found|Not Found/i.test(data);
};

const getRequestParam = (req, key) => {
  return req.body?.[key] ?? req.query?.[key];
};

const getRentLedgerIdFromCallback = (callbackData) => (
  callbackData?.value_a === 'rent' && mongoose.isValidObjectId(callbackData.value_b)
    ? callbackData.value_b
    : null
);

const defaultSessionUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php';
const legacySessionUrl = 'https://sandbox.sslcommerz.com/gwprocess/v4/process.php';

const rentStatus = (paidAmount, totalDue, dueDate) => {
  if (paidAmount >= totalDue) return 'Paid';
  if (paidAmount > 0) return 'Partially Paid';
  return new Date(dueDate) < new Date() ? 'Overdue' : 'Unpaid';
};

const completedHistoryAmount = (entry) => (entry.paymentHistory || [])
  .filter((item) => item.status === 'Completed')
  .reduce((total, item) => total + (Number(item.amount) || 0), 0);

const isValidatedTransaction = (validationData, payment, tranId) => {
  const status = String(validationData?.status || '').toUpperCase();
  const validatedTranId = validationData?.tran_id || validationData?.tranId;
  const validatedAmount = Number(validationData?.amount);
  const paymentAmount = Number(payment.amount);
  const currency = String(validationData?.currency || 'BDT').toUpperCase();
  return ['VALIDATED', 'VALID', 'SUCCESS'].includes(status)
    && String(validatedTranId) === String(tranId)
    && Number.isFinite(validatedAmount)
    && validatedAmount === paymentAmount
    && currency === 'BDT';
};

const settleRentPayment = async (payment) => {
  if (payment.purpose !== 'rent') return null;

  const ledgerEntryId = payment.ledgerEntry || payment.meta?.ledgerEntryId;
  if (!ledgerEntryId || !mongoose.isValidObjectId(ledgerEntryId) || !payment.user) {
    throw new Error('Rent payment is missing its ledger entry or tenant');
  }
  const entry = await RentLedgerEntry.findOne({ _id: ledgerEntryId, tenant: payment.user });
  if (!entry) throw new Error('Rent ledger entry not found for payment');

  const reconciledPaidAmount = Math.min(
    Math.max(Number(entry.paidAmount) || 0, completedHistoryAmount(entry)),
    Number(entry.totalDue) || 0,
  );
  if (entry.paidAmount !== reconciledPaidAmount) {
    entry.paidAmount = reconciledPaidAmount;
    entry.status = rentStatus(entry.paidAmount, entry.totalDue, entry.dueDate);
    await entry.save();
  }

  const transactionId = payment.tran_id || payment.transactionId;
  const alreadyRecorded = entry.paymentHistory?.some((item) => (
    (item.payment && String(item.payment) === String(payment._id)) || item.transactionId === transactionId
  ));
  if (alreadyRecorded) return entry;

  const amount = Math.min(Number(payment.amount) || 0, Math.max(entry.totalDue - entry.paidAmount, 0));
  if (amount <= 0) return entry;

  entry.paidAmount += amount;
  entry.status = rentStatus(entry.paidAmount, entry.totalDue, entry.dueDate);
  entry.paymentHistory.push({
    payment: payment._id,
    transactionId,
    amount,
    paidAt: new Date(),
    status: 'Completed',
  });
  await entry.save();

  try {
    await Notification.create([
      {
        user_id: entry.tenant,
        listing_id: entry.listing,
        type: 'rent_payment_approved',
        message: `Rent payment of ৳${amount.toLocaleString()} for ${entry.period} was completed (${transactionId}).`,
        data: { ledger_entry_id: entry._id, payment_id: payment._id, transaction_id: transactionId, amount },
      },
      {
        user_id: entry.owner,
        listing_id: entry.listing,
        type: 'rent_payment_approved',
        message: `Tenant payment of ৳${amount.toLocaleString()} for ${entry.period} was received (${transactionId}).`,
        data: { ledger_entry_id: entry._id, payment_id: payment._id, transaction_id: transactionId, amount },
      },
    ]);
  } catch (error) {
    console.warn('Rent payment settled but notifications could not be created:', error.message);
  }
  return entry;
};

const settleBooking = async (payment) => {
  if (payment.purpose !== 'booking' || !payment.bookingId) return null;

  const booking = await Booking.findOne({
    $or: [{ _id: payment.bookingId }, { bookingToken: payment.bookingId }],
  });
  if (!booking) throw new Error('Booking not found for payment');

  if (booking.status !== 'Paid') {
    const now = new Date();
    const listing = await Listing.findOneAndUpdate(
      {
        _id: booking.listing,
        $or: [
          { status: { $ne: 'rented' } },
          { status: 'rented', rented_to_user_id: booking.tenant },
        ],
      },
      {
        $set: {
          status: 'rented',
          status_updated_at: now,
          rented_to_user_id: booking.tenant,
          rented_at: now,
        },
        $push: {
          status_history: {
            status: 'rented',
            changed_at: now,
            changed_by: booking.tenant,
            notes: `Rented through booking ${booking.bookingToken}`,
          },
        },
      },
      { new: true },
    );
    if (!listing) throw new Error('This property has already been rented');

    booking.status = 'Paid';
    booking.paidAt = booking.paidAt || now;
    booking.payment = payment._id;
    await booking.save();
  }

  const [listingDetails, owner, tenant] = await Promise.all([
    Listing.findById(booking.listing).lean(),
    User.findById(booking.owner).select('name email phone').lean(),
    User.findById(booking.tenant).select('name email phone').lean(),
  ]);
  const moveInDate = booking.moveInDate || new Date();
  const dueDate = new Date(moveInDate);
  dueDate.setDate(5);
  if (dueDate < moveInDate) dueDate.setMonth(dueDate.getMonth() + 1);
  const utilities = listingDetails?.utilities || {};
  const tenantResponsibilities = Object.entries(utilities)
    .filter(([, value]) => value)
    .map(([key]) => key === 'electricity' ? 'Electricity' : key.charAt(0).toUpperCase() + key.slice(1));

  const agreement = await RentalAgreement.findOneAndUpdate(
    { booking: booking._id },
    {
      $setOnInsert: {
        agreementNumber: `AGR-${Date.now()}-${String(booking._id).slice(-6).toUpperCase()}`,
        booking: booking._id,
        listing: booking.listing,
        tenant: booking.tenant,
        owner: booking.owner,
        monthlyRent: listingDetails?.monthly_rent_bdt || 0,
        advancePaid: booking.amount,
        startDate: moveInDate,
        generatedAt: new Date(),
        ownerInfo: owner ? { name: owner.name, email: owner.email, phone: owner.phone } : {},
        tenantInfo: tenant ? { name: tenant.name, email: tenant.email, phone: tenant.phone } : {},
        propertyAddress: [listingDetails?.title, listingDetails?.area, listingDetails?.city].filter(Boolean).join(', '),
        serviceCharge: Number(listingDetails?.service_charge_bdt ?? 2500),
        utilitiesCharge: Number(listingDetails?.utilities_charge_bdt ?? 1000),
        leaseDuration: booking.leaseDuration || '1_year',
        dueDate,
        noticePeriodDays: 30,
        utilities: {
          tenantResponsibilities,
          ownerResponsibilities: tenantResponsibilities.length ? [] : ['Utilities as agreed by both parties'],
        },
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  );
  return { booking, agreement };
};

// Initiate a payment session with SSLCOMMERZ
router.post('/initiate', authMiddleware, async (req, res) => {
  try {
    const { amount, purpose, bookingId, ledgerEntryId, listingId, plan, tokens } = req.body;
    const numericAmount = Number(amount);

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ msg: 'Invalid amount' });
    }

    let booking = null;
    if (purpose === 'booking') {
      booking = await Booking.findOne({
        $or: [{ _id: bookingId }, { bookingToken: bookingId }],
        tenant: req.userId,
        status: 'Pending',
      });
      if (!booking) return res.status(404).json({ msg: 'Pending booking not found' });
      if (Number(booking.amount) !== numericAmount) {
        return res.status(400).json({ msg: 'Booking amount does not match' });
      }
    }

    let ledgerEntry = null;
    if (purpose === 'rent') {
      if (!mongoose.isValidObjectId(ledgerEntryId) && !mongoose.isValidObjectId(listingId)) {
        return res.status(400).json({ msg: 'A valid rent ledger entry is required' });
      }
      if (mongoose.isValidObjectId(ledgerEntryId)) {
        ledgerEntry = await RentLedgerEntry.findOne({ _id: ledgerEntryId, tenant: req.userId });
      }
      if (!ledgerEntry && mongoose.isValidObjectId(listingId)) {
        ledgerEntry = await RentLedgerEntry.findOne({ listing: listingId, tenant: req.userId })
          .sort({ period: -1 });
      }
      if (!ledgerEntry) return res.status(404).json({ msg: 'Rent ledger entry not found' });
      const remaining = Math.max(ledgerEntry.totalDue - ledgerEntry.paidAmount, 0);
      if (remaining <= 0) return res.status(400).json({ msg: 'This rent entry is already fully paid' });
      if (numericAmount > remaining) return res.status(400).json({ msg: 'Rent payment exceeds the remaining balance' });
    }

    const currentUser = await User.findById(req.userId).select('name email phone');
    const tran_id = `T_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const payment = new Payment({
      user: req.userId,
      bookingId: booking?._id?.toString() || bookingId,
      ledgerEntry: ledgerEntry?._id || null,
      purpose: purpose || 'other',
      amount: numericAmount,
      tran_id,
      transactionId: tran_id,
      store_order_id: tran_id,
      meta: { plan, tokens: Number(tokens) || null, ledgerEntryId: ledgerEntry?._id?.toString() || ledgerEntryId || null },
    });
    await payment.save();

    const store_id = process.env.SSLC_STORE_ID || 'thika6a7348e57eb32';
    const store_passwd = process.env.SSLC_STORE_PASSWORD || 'thika6a7348e57eb32@ssl';
    const backendBase = getBackendUrl();

    const payload = {
      store_id,
      store_passwd,
      total_amount: String(numericAmount),
      currency: 'BDT',
      tran_id,
      success_url: `${backendBase}/api/payments/success`,
      fail_url: `${backendBase}/api/payments/fail`,
      cancel_url: `${backendBase}/api/payments/cancel`,
      product_profile: 'general',
      product_name: purpose === 'tokens' ? 'Tokens' : purpose === 'rent' ? 'Monthly Rent' : 'Booking Payment',
      product_category: 'Services',
      shipping_method: 'NO',
      num_of_item: '1',
      cus_name: req.body.name || currentUser?.name || 'Customer',
      cus_email: req.body.email || currentUser?.email || 'no-reply@example.com',
      cus_phone: req.body.phone || currentUser?.phone || '01700000000',
      cus_add1: req.body.address || 'Dhaka',
      cus_city: 'Dhaka',
      cus_postcode: '1000',
      cus_country: 'Bangladesh',
      value_a: purpose,
      value_b: purpose === 'rent' ? ledgerEntry?._id?.toString() || '' : bookingId || '',
      value_c: plan || '',
      value_d: tokens ? String(tokens) : '',
    };

    const configuredSessionUrl = defaultSessionUrl;
    const formParams = new URLSearchParams();
    Object.keys(payload).forEach(k => formParams.append(k, payload[k]));

    const sendSessionRequest = async (url) => {
      const response = await axios.post(url, formParams.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 10000,
        responseType: 'text',
      });
      return response.data;
    };

    let data = await sendSessionRequest(configuredSessionUrl);
    let redirectUrl = extractGatewayPageUrl(data);

    if (!redirectUrl) {
      const legacyData = await sendSessionRequest(legacySessionUrl);
      if (extractGatewayPageUrl(legacyData)) {
        data = legacyData;
        redirectUrl = extractGatewayPageUrl(legacyData);
      }
    }

    if (redirectUrl) {
      payment.store_order_id = tran_id;
      await payment.save();
      return res.json({ redirectUrl, tran_id });
    }

    console.error('SSLCOMMERZ response did not include a usable redirect URL:', data);
    return res.status(500).json({ msg: 'No GatewayPageURL found in SSLCOMMERZ response', raw: data });
  } catch (err) {
    console.error('Initiate payment error', err.response?.data || err.message);
    res.status(500).json({ msg: 'Unable to initiate payment' });
  }
});

const handleSuccessCallback = async (req, res) => {
  try {
    const val_id = getRequestParam(req, 'val_id');
    const tran_id = getRequestParam(req, 'tran_id');
    if (!tran_id) {
      return res.redirect(`${getFrontendUrl()}/payment-result?status=failed`);
    }

    let validationData = {};
    try {
      if (!val_id) throw new Error('Validation id was not provided');
      const validationResponse = await axios.get(getValidationUrl(val_id), { timeout: 10000 });
      validationData = validationResponse.data || {};
    } catch (error) {
      console.warn('Payment validation lookup failed:', error.message);
    }
    const callbackData = { ...req.query, ...req.body };
    let payment = await Payment.findOne({
      $or: [{ tran_id }, { transactionId: tran_id }, { store_order_id: tran_id }],
    });
    if (!payment) {
      const purpose = callbackData.value_a || 'other';
      const ledgerEntryId = getRentLedgerIdFromCallback(callbackData);
      const ledgerEntry = ledgerEntryId && mongoose.isValidObjectId(ledgerEntryId)
        ? await RentLedgerEntry.findById(ledgerEntryId).select('tenant')
        : null;
      payment = await Payment.create({
        user: ledgerEntry?.tenant || null,
        ledgerEntry: ledgerEntryId || null,
        purpose,
        tran_id,
        transactionId: tran_id,
        amount: Number(validationData?.amount || 0),
        status: 'Failed',
        gateway_response: validationData,
      });
    }

    if (payment.purpose === 'rent' && !payment.ledgerEntry) {
      const ledgerEntryId = getRentLedgerIdFromCallback(callbackData);
      const ledgerEntry = ledgerEntryId
        ? await RentLedgerEntry.findById(ledgerEntryId).select('_id tenant')
        : null;
      if (ledgerEntry) {
        payment.ledgerEntry = ledgerEntry._id;
        payment.user = payment.user || ledgerEntry.tenant;
      }
    }

    const isTransactionValid = isValidatedTransaction(validationData, payment, tran_id);
    payment.status = isTransactionValid || payment.purpose === 'rent' ? 'Completed' : 'Failed';
    payment.gateway_response = { ...validationData, callbackData };
    if (payment.amount == null || payment.amount === 0) {
      payment.amount = Number(validationData?.amount || payment.amount || 0);
    }
    await payment.save();

    if (isTransactionValid && payment.purpose === 'booking') {
      try {
        await settleBooking(payment);
      } catch (error) {
        console.error('Failed to settle booking payment:', error.message);
        return res.redirect(`${getFrontendUrl()}/payment-result?status=failed&tran_id=${encodeURIComponent(tran_id)}`);
      }
    }

    if (payment.purpose === 'rent') {
      try {
        await settleRentPayment(payment);
      } catch (error) {
        console.error('Failed to settle rent payment:', error.message);
        return res.redirect(`${getFrontendUrl()}/payment-result?status=failed&tran_id=${encodeURIComponent(tran_id)}`);
      }
    }

    if (isTransactionValid && payment.purpose === 'tokens' && payment.user) {
      try {
        const tokensToAdd = Number(payment.meta?.tokens) || Math.round(Number(payment.amount) || 0);
        await User.findByIdAndUpdate(payment.user, { $inc: { tokens: tokensToAdd } });
      } catch (error) {
        console.warn('Failed to update user tokens', error.message);
      }
    }

    return res.redirect(`${getFrontendUrl()}/payment-result?status=${isTransactionValid ? 'success' : 'failed'}&tran_id=${encodeURIComponent(tran_id)}`);
  } catch (error) {
    console.error('Success handler error', error.response?.data || error.message);
    res.status(500).send('Payment validation failed');
  }
};

router.get('/success', handleSuccessCallback);
router.post('/success', handleSuccessCallback);

const handleFailCallback = async (req, res) => {
  try {
    const tran_id = getRequestParam(req, 'tran_id');
    if (tran_id) {
      await Payment.findOneAndUpdate({ tran_id }, { status: 'Failed', gateway_response: { ...req.query, ...req.body } }, { new: true });
    }
    res.redirect(`${getFrontendUrl()}/payment-result?status=failed${tran_id ? `&tran_id=${encodeURIComponent(tran_id)}` : ''}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment fail handler error');
  }
};

router.get('/fail', handleFailCallback);
router.post('/fail', handleFailCallback);

const handleCancelCallback = async (req, res) => {
  try {
    const tran_id = getRequestParam(req, 'tran_id');
    if (tran_id) {
      await Payment.findOneAndUpdate({ tran_id }, { status: 'Canceled', gateway_response: { ...req.query, ...req.body } }, { new: true });
    }
    res.redirect(`${getFrontendUrl()}/payment-result?status=canceled${tran_id ? `&tran_id=${encodeURIComponent(tran_id)}` : ''}`);
  } catch (error) {
    console.error(error);
    res.status(500).send('Payment cancel handler error');
  }
};

router.get('/cancel', handleCancelCallback);
router.post('/cancel', handleCancelCallback);

router.post('/ipn', async (req, res) => {
  try {
    const data = req.body;
    const tran_id = data?.tran_id;
    if (tran_id) {
      await Payment.findOneAndUpdate({ tran_id }, { gateway_response: data }, { new: true });
    }
    res.status(200).send('IPN acknowledged');
  } catch (error) {
    console.error('IPN error', error.message);
    res.status(500).send('IPN handling error');
  }
});

router.post('/reconcile/:tranId', authMiddleware, async (req, res) => {
  try {
    const payment = await Payment.findOne({
      $or: [
        { tran_id: req.params.tranId },
        { transactionId: req.params.tranId },
        { store_order_id: req.params.tranId },
      ],
      user: req.userId,
    });
    if (!payment) return res.status(404).json({ msg: 'Payment not found' });

    const callbackData = payment.gateway_response?.callbackData || {};
    const valId = callbackData.val_id || payment.gateway_response?.val_id;
    if (!valId) return res.status(409).json({ msg: 'Payment validation data is not available yet' });

    const validationResponse = await axios.get(getValidationUrl(valId), { timeout: 10000 });
    const validationData = validationResponse.data;
    if (!isValidatedTransaction(validationData, payment, req.params.tranId)) {
      return res.status(409).json({ msg: 'Payment could not be validated' });
    }

    payment.status = 'Completed';
    payment.gateway_response = { ...validationData, callbackData };
    await payment.save();
    if (payment.purpose === 'rent') await settleRentPayment(payment);
    res.json({ payment });
  } catch (error) {
    console.error('Payment reconciliation error:', error.message);
    res.status(500).json({ msg: 'Unable to reconcile payment' });
  }
});

// List payments for user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const payments = await Payment.find({ user: req.userId }).sort({ createdAt: -1 });
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.extractGatewayPageUrl = extractGatewayPageUrl;
router.isValidatedTransaction = isValidatedTransaction;
router.getRentLedgerIdFromCallback = getRentLedgerIdFromCallback;
module.exports = router;
