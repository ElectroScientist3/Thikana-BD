const express = require('express');
const VerificationDocument = require('../models/VerificationDocument');
const DuplicateFlag = require('../models/DuplicateFlag');
const Listing = require('../models/Listing');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');
const { sendVerificationStatusNotification } = require('../services/notificationService');

const router = express.Router();
router.use(authMiddleware, requireAdmin());

router.get('/verifications', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = req.query.status ? { verificationStatus: req.query.status } : {};
    const [verifications, total] = await Promise.all([
      VerificationDocument.find(query).populate('propertyId').populate('ownerId', 'name email phone').sort({ submittedAt: -1 }).skip((page - 1) * limit).limit(limit),
      VerificationDocument.countDocuments(query),
    ]);
    res.json({ verifications, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load verification queue' });
  }
});

router.get('/verifications/stats', async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const [stats, reviewedToday] = await Promise.all([
      VerificationDocument.aggregate([{ $group: { _id: '$verificationStatus', count: { $sum: 1 } } }]),
      VerificationDocument.countDocuments({ reviewedAt: { $gte: startOfToday } }),
    ]);
    res.json({ stats: { ...stats.reduce((result, item) => ({ ...result, [item._id]: item.count }), {}), reviewedToday } });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load verification stats' });
  }
});

router.get('/verifications/:id', async (req, res) => {
  try {
    const verification = await VerificationDocument.findById(req.params.id).populate('propertyId').populate('ownerId', 'name email phone').populate('reviewedBy', 'name email');
    if (!verification) return res.status(404).json({ msg: 'Verification not found' });
    res.json({ verification });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load verification details' });
  }
});

router.put('/verifications/:id/review', async (req, res) => {
  try {
    const { status, rejectionReason, reviewNotes, badge = 'basic' } = req.body;
    if (!['approved', 'rejected', 'requires_more_info', 'under_review'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid verification status' });
    }
    const verification = await VerificationDocument.findById(req.params.id).populate('propertyId', 'title owner_id');
    if (!verification) return res.status(404).json({ msg: 'Verification not found' });
    verification.verificationStatus = status;
    verification.rejectionReason = rejectionReason;
    verification.reviewNotes = reviewNotes;
    verification.reviewedBy = req.userId;
    verification.reviewedAt = new Date();
    await verification.save();

    const listing = await Listing.findByIdAndUpdate(verification.propertyId._id, {
      isVerified: status === 'approved',
      verificationBadge: status === 'approved' ? (['basic', 'premium'].includes(badge) ? badge : 'basic') : 'none',
      verifiedAt: status === 'approved' ? new Date() : undefined,
    }, { new: true });
    void sendVerificationStatusNotification(verification.ownerId, listing?.title || 'your property', status, listing?._id);
    res.json({ verification, property: listing });
  } catch (err) {
    console.error('[AdminVerification] review failed:', err.message);
    res.status(500).json({ msg: 'Unable to review verification' });
  }
});

router.get('/duplicates', async (req, res) => {
  try {
    const query = req.query.status ? { status: req.query.status } : {};
    const flags = await DuplicateFlag.find(query).populate('propertyId').populate('suspectedDuplicateOf').populate('reviewedBy', 'name email').sort({ overallSimilarity: -1, createdAt: -1 });
    res.json({ flags });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load duplicate flags' });
  }
});

router.put('/duplicates/:id/resolve', async (req, res) => {
  try {
    const { status, reviewNotes } = req.body;
    if (!['confirmed_duplicate', 'not_duplicate', 'dismissed'].includes(status)) return res.status(400).json({ msg: 'Invalid duplicate resolution' });
    const flag = await DuplicateFlag.findByIdAndUpdate(req.params.id, { status, reviewNotes, reviewedBy: req.userId }, { new: true }).populate('propertyId');
    if (!flag) return res.status(404).json({ msg: 'Duplicate flag not found' });
    await Listing.findByIdAndUpdate(flag.propertyId._id, { $inc: { duplicateFlagCount: status === 'confirmed_duplicate' ? 0 : -1 } });
    res.json({ flag });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to resolve duplicate flag' });
  }
});

module.exports = router;
