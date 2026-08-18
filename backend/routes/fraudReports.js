const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const FraudReport = require('../models/FraudReport');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { evidenceUpload, fraudUploadsRoot } = require('../config/multerConfig');
const { sendFraudReportNotification, sendFraudResolutionNotification, sendFraudWarningNotification } = require('../services/notificationService');

const router = express.Router();
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const backendUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const fileUrl = (file) => `${backendUrl()}/uploads/fraud-reports/${path.relative(fraudUploadsRoot, file.path).replace(/\\/g, '/')}`;
const reportTypes = ['fake_listing', 'hidden_charges', 'incorrect_photos', 'broker_fraud', 'already_rented', 'scam_attempt', 'duplicate_listing', 'other'];
const uploadEvidence = (req, res, next) => evidenceUpload.array('evidence', 5)(req, res, (err) => {
  if (err) return res.status(400).json({ msg: err.message || 'Invalid evidence upload' });
  next();
});

router.post('/fraud-reports', authMiddleware, uploadEvidence, async (req, res) => {
  try {
    const { propertyId, reportType, description } = req.body;
    if (!validId(propertyId)) return res.status(400).json({ msg: 'Valid propertyId is required' });
    if (!reportTypes.includes(reportType)) return res.status(400).json({ msg: 'Invalid report type' });
    if (!description || description.trim().length < 50 || description.trim().length > 1000) return res.status(400).json({ msg: 'Description must be between 50 and 1000 characters' });
    const listing = await Listing.findById(propertyId);
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    const report = await FraudReport.create({ propertyId, reporterId: req.userId, reportType, description: description.trim(), evidence: (req.files || []).map(fileUrl) });
    await Listing.updateOne({ _id: propertyId }, { $inc: { fraudReportCount: 1 } });
    const admins = await User.find({ role: 'admin', isSuspended: { $ne: true } }).select('_id');
    void sendFraudReportNotification(admins.map((admin) => admin._id), reportType, listing.title, report._id);
    res.status(201).json({ report });
  } catch (err) {
    res.status(500).json({ msg: err.message || 'Unable to file fraud report' });
  }
});

router.get('/fraud-reports/my', authMiddleware, async (req, res) => {
  try {
    const reports = await FraudReport.find({ reporterId: req.userId }).populate('propertyId', 'title area city').sort({ createdAt: -1 });
    res.json({ reports });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load your fraud reports' });
  }
});

router.get('/admin/fraud-reports', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = {};
    ['status', 'reportType', 'severity'].forEach((field) => { if (req.query[field]) query[field] = req.query[field]; });
    const [reports, total] = await Promise.all([
      FraudReport.find(query).populate('propertyId').populate('reporterId', 'name email phone').populate('reviewedBy', 'name email').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      FraudReport.countDocuments(query),
    ]);
    res.json({ reports, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load fraud reports' });
  }
});

router.get('/admin/fraud-reports/stats', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const [counts, severities, types, topReported] = await Promise.all([
      FraudReport.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      FraudReport.aggregate([{ $group: { _id: '$severity', count: { $sum: 1 } } }]),
      FraudReport.aggregate([{ $group: { _id: '$reportType', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      FraudReport.aggregate([{ $group: { _id: '$propertyId', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 10 }, { $lookup: { from: 'listings', localField: '_id', foreignField: '_id', as: 'property' } }]),
    ]);
    res.json({ counts: { ...counts.reduce((result, item) => ({ ...result, [item._id]: item.count }), {}), ...severities.reduce((result, item) => ({ ...result, [item._id]: item.count }), {}) }, reportTypes: types, topReported });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load fraud report stats' });
  }
});

router.get('/admin/fraud-reports/:id', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const report = await FraudReport.findById(req.params.id).populate('propertyId').populate('reporterId', 'name email phone').populate('reviewedBy', 'name email');
    if (!report) return res.status(404).json({ msg: 'Fraud report not found' });
    const relatedReports = await FraudReport.find({ propertyId: report.propertyId._id, _id: { $ne: report._id } }).populate('reporterId', 'name email').sort({ createdAt: -1 });
    res.json({ report, relatedReports });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load fraud report details' });
  }
});

router.put('/admin/fraud-reports/:id', authMiddleware, requireAdmin(), async (req, res) => {
  try {
    const { status, actionTaken, adminNotes } = req.body;
    if (!['pending', 'investigating', 'resolved', 'dismissed'].includes(status)) return res.status(400).json({ msg: 'Invalid report status' });
    if (!['no_action', 'warning_sent', 'listing_hidden', 'listing_removed', 'account_suspended'].includes(actionTaken)) return res.status(400).json({ msg: 'Invalid action' });
    const report = await FraudReport.findById(req.params.id).populate('propertyId');
    if (!report) return res.status(404).json({ msg: 'Fraud report not found' });
    const listing = report.propertyId;
    if (actionTaken === 'listing_hidden') await Listing.findByIdAndUpdate(listing._id, { status: 'on_hold', hold_expiry_date: undefined });
    if (actionTaken === 'listing_removed') await Listing.deleteOne({ _id: listing._id });
    if (actionTaken === 'account_suspended') await User.findByIdAndUpdate(listing.owner_id, { isSuspended: true });
    if (actionTaken === 'warning_sent') void sendFraudWarningNotification(listing.owner_id, listing.title, report._id);
    report.status = status;
    report.actionTaken = actionTaken;
    report.adminNotes = adminNotes;
    report.reviewedBy = req.userId;
    report.resolvedAt = ['resolved', 'dismissed'].includes(status) ? new Date() : undefined;
    await report.save();
    void sendFraudResolutionNotification(report.reporterId, listing.title, status, actionTaken, report._id);
    res.json({ report });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to update fraud report' });
  }
});

module.exports = router;
