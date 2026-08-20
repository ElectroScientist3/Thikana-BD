const express = require('express');
const Booking = require('../models/Booking');
const RentalAgreement = require('../models/RentalAgreement');
const Listing = require('../models/Listing');
const User = require('../models/User');
const PDFDocument = require('pdfkit');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const bookingPopulate = [
  { path: 'listing', select: 'title area city monthly_rent_bdt advance_bdt service_charge_bdt images status rented_to_user_id utilities' },
  { path: 'tenant', select: 'name email phone' },
  { path: 'owner', select: 'name email phone' },
  { path: 'viewingAppointment', select: 'requested_date requested_time duration_minutes status' },
  { path: 'payment', select: 'tran_id transactionId amount status createdAt' },
];

router.get('/tenant', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ tenant: req.userId }).populate(bookingPopulate).sort({ createdAt: -1 }).lean();
    const agreements = await RentalAgreement.find({ tenant: req.userId }).select('agreementNumber booking status startDate generatedAt').lean();
    res.json({ bookings, agreements });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/owner', authMiddleware, async (req, res) => {
  try {
    const bookings = await Booking.find({ owner: req.userId }).populate(bookingPopulate).sort({ createdAt: -1 }).lean();
    const agreements = await RentalAgreement.find({ owner: req.userId }).select('agreementNumber booking tenant listing status startDate generatedAt').populate('tenant', 'name email phone').populate('listing', 'title area city').lean();
    res.json({ bookings, agreements });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/:id/agreement/pdf', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).lean();
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });
    if (![booking.tenant?.toString(), booking.owner?.toString()].includes(req.userId)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    if (booking.status !== 'Paid') return res.status(400).json({ msg: 'Agreement is available after payment' });

    const agreement = await RentalAgreement.findOne({ booking: booking._id }).lean();
    if (!agreement) return res.status(404).json({ msg: 'Rental agreement not found' });
    const [listing, owner, tenant] = await Promise.all([
      Listing.findById(booking.listing).lean(),
      User.findById(booking.owner).select('name email phone').lean(),
      User.findById(booking.tenant).select('name email phone').lean(),
    ]);

    const currency = booking.currency || 'BDT';
    const money = (value) => `${currency} ${Number(value || 0).toLocaleString()}`;
    const date = (value) => value ? new Date(value).toLocaleDateString('en-GB') : 'Not specified';
    const ordinal = (value) => {
      const remainder = value % 100;
      if (remainder >= 11 && remainder <= 13) return `${value}th`;
      const suffixes = { 1: 'st', 2: 'nd', 3: 'rd' };
      return `${value}${suffixes[value % 10] || 'th'}`;
    };
    const duration = String(agreement.leaseDuration || '1_year').replace('_', ' ');
    const document = new PDFDocument({ margin: 50 });
    const fileName = `rental-agreement-${agreement.agreementNumber}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    document.pipe(res);
    document.fontSize(20).fillColor('#0f172a').text('THIKANA RENTAL AGREEMENT', { align: 'center' });
    document.moveDown(0.4).fontSize(10).fillColor('#475569').text(`Agreement No: ${agreement.agreementNumber}`, { align: 'center' });
    document.moveDown().strokeColor('#cbd5e1').moveTo(50, document.y).lineTo(545, document.y).stroke();

    const section = (heading) => document.moveDown().fontSize(13).fillColor('#0f766e').text(heading).moveDown(0.25);
    const row = (label, value) => document.fontSize(10).fillColor('#334155').text(`${label}: `, { continued: true }).fillColor('#0f172a').text(value || 'Not specified');
    section('Parties');
    row('Owner', `${owner?.name || agreement.ownerInfo?.name || 'Not specified'} | ${owner?.email || agreement.ownerInfo?.email || 'No email'} | ${owner?.phone || agreement.ownerInfo?.phone || 'No phone'}`);
    row('Tenant', `${tenant?.name || agreement.tenantInfo?.name || 'Not specified'} | ${tenant?.email || agreement.tenantInfo?.email || 'No email'} | ${tenant?.phone || agreement.tenantInfo?.phone || 'No phone'}`);
    section('Property');
    row('Address', agreement.propertyAddress || [listing?.title, listing?.area, listing?.city].filter(Boolean).join(', '));
    row('Booking token', booking.bookingToken);
    section('Financial Terms');
    row('Monthly rent', money(agreement.monthlyRent));
    row('Advance payment', money(agreement.advancePaid));
    row('Service charge', money(agreement.serviceCharge));
    row('Rent due date', agreement.dueDate ? `Every month on the ${ordinal(new Date(agreement.dueDate).getDate())}` : 'Not specified');
    section('Rental Terms');
    row('Rental duration', duration);
    row('Start date', date(agreement.startDate));
    row('Notice period', `${agreement.noticePeriodDays || 30} days`);
    section('Utility Responsibilities');
    row('Tenant', agreement.utilities?.tenantResponsibilities?.join(', ') || 'As agreed by both parties');
    row('Owner', agreement.utilities?.ownerResponsibilities?.join(', ') || 'As agreed by both parties');
    document.moveDown(1.5).fontSize(9).fillColor('#64748b').text('This agreement was generated electronically by Thikana after successful booking payment.');
    document.end();
  } catch (err) {
    console.error('Agreement PDF error:', err);
    if (!res.headersSent) res.status(500).json({ msg: 'Unable to generate rental agreement PDF' });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate(bookingPopulate).lean();
    if (!booking) return res.status(404).json({ msg: 'Booking not found' });
    if (![booking.tenant?._id?.toString(), booking.owner?._id?.toString()].includes(req.userId)) {
      return res.status(403).json({ msg: 'Not authorized' });
    }
    const agreement = await RentalAgreement.findOne({ booking: booking._id }).lean();
    res.json({ booking, agreement });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;