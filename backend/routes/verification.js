const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const VerificationDocument = require('../models/VerificationDocument');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');
const { verificationUpload, uploadsRoot } = require('../config/multerConfig');
const { sendMessage } = require('../services/telegramBot');

const router = express.Router();
const documentFields = [
  { name: 'utilityBill', maxCount: 1 },
  { name: 'ownershipDoc', maxCount: 1 },
  { name: 'nidFront', maxCount: 1 },
  { name: 'nidBack', maxCount: 1 },
  { name: 'addressProof', maxCount: 1 },
  { name: 'propertyPhotos', maxCount: 20 },
];

const fileUrl = (file, propertyId) => {
  if (!file) return undefined;
  const propertyDirectory = path.join(uploadsRoot, String(propertyId));
  fs.mkdirSync(propertyDirectory, { recursive: true });
  const targetPath = path.join(propertyDirectory, path.basename(file.filename));
  if (path.resolve(file.path) !== path.resolve(targetPath)) fs.renameSync(file.path, targetPath);
  const backendUrl = process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
  return `${backendUrl}/uploads/verification/${propertyId}/${path.basename(targetPath)}`;
};
const ownerProperty = (propertyId, ownerId) => Listing.findOne({ _id: propertyId, owner_id: ownerId });
const handleVerificationUpload = (req, res, next) => verificationUpload.fields(documentFields)(req, res, (err) => {
  if (err) return res.status(400).json({ msg: err.message || 'Invalid verification upload' });
  next();
});

router.post('/submit', authMiddleware, requireOwner(), handleVerificationUpload, async (req, res) => {
  try {
    const { propertyId } = req.body;
    const listing = await ownerProperty(propertyId, req.userId);
    if (!listing) return res.status(404).json({ msg: 'Property not found or not owned by you' });

    const files = req.files || {};
    const requiredFields = ['utilityBill', 'ownershipDoc', 'nidFront', 'nidBack', 'addressProof'];
    const missing = requiredFields.filter((field) => !files[field]?.[0]);
    if (missing.length || (files.propertyPhotos || []).length < 3) {
      return res.status(400).json({ msg: 'Utility bill, ownership document, both NID files, address proof, and at least 3 property photos are required' });
    }

    const documents = {
      utilityBill: fileUrl(files.utilityBill[0], listing._id),
      ownershipDoc: fileUrl(files.ownershipDoc[0], listing._id),
      nidFront: fileUrl(files.nidFront[0], listing._id),
      nidBack: fileUrl(files.nidBack[0], listing._id),
      addressProof: fileUrl(files.addressProof[0], listing._id),
      propertyPhotos: files.propertyPhotos.map((file) => fileUrl(file, listing._id)),
    };
    const verification = await VerificationDocument.findOneAndUpdate(
      { propertyId: listing._id },
      {
        propertyId: listing._id,
        ownerId: req.userId,
        documents,
        verificationStatus: 'pending',
        rejectionReason: undefined,
        reviewedBy: undefined,
        reviewedAt: undefined,
        submittedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json({ msg: 'Verification submitted successfully', verification });
  } catch (err) {
    console.error('[Verification] submit failed:', err.message);
    res.status(err.code === 'LIMIT_FILE_SIZE' ? 400 : 500).json({ msg: err.message || 'Unable to submit verification' });
  }
});

router.post('/send-otp', authMiddleware, requireOwner(), async (req, res) => {
  try {
    const { propertyId, phone } = req.body;
    const listing = await ownerProperty(propertyId, req.userId);
    if (!listing) return res.status(404).json({ msg: 'Property not found or not owned by you' });
    const user = await User.findById(req.userId).select('telegramChatId telegramLinked');
    if (!user.telegramLinked || !user.telegramChatId) return res.status(400).json({ msg: 'Link Telegram before requesting mobile verification' });

    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000);
    await VerificationDocument.findOneAndUpdate(
      { propertyId: listing._id },
      { propertyId: listing._id, ownerId: req.userId, 'mobileVerification.phone': phone, 'mobileVerification.otp': otp, 'mobileVerification.otpExpiresAt': otpExpiresAt },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await sendMessage(user.telegramChatId, `ThikanaBD verification code: ${otp}\nThikanaBD verification code: ${otp}`);
    res.json({ msg: 'OTP sent through Telegram', expiresAt: otpExpiresAt });
  } catch (err) {
    console.error('[Verification] send-otp failed:', err.message);
    res.status(500).json({ msg: 'Unable to send verification OTP' });
  }
});

router.post('/verify-otp', authMiddleware, requireOwner(), async (req, res) => {
  try {
    const verification = await VerificationDocument.findOne({ propertyId: req.body.propertyId, ownerId: req.userId });
    if (!verification || verification.mobileVerification.otp !== String(req.body.otp || '') || !verification.mobileVerification.otpExpiresAt || verification.mobileVerification.otpExpiresAt < new Date()) {
      return res.status(400).json({ msg: 'Invalid or expired OTP' });
    }
    verification.mobileVerification.verified = true;
    verification.mobileVerification.verifiedAt = new Date();
    verification.mobileVerification.otp = undefined;
    verification.mobileVerification.otpExpiresAt = undefined;
    await verification.save();
    res.json({ msg: 'Mobile number verified successfully', verification });
  } catch (err) {
    console.error('[Verification] verify-otp failed:', err.message);
    res.status(500).json({ msg: 'Unable to verify OTP' });
  }
});

router.get('/status/:propertyId', authMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.propertyId);
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    if (String(listing.owner_id) !== String(req.userId)) return res.status(403).json({ msg: 'Not authorized' });
    const verification = await VerificationDocument.findOne({ propertyId: listing._id });
    res.json({ property: listing, verification });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load verification status' });
  }
});

router.get('/my-properties', authMiddleware, requireOwner(), async (req, res) => {
  try {
    const properties = await Listing.find({ owner_id: req.userId }).sort({ createdAt: -1 }).lean();
    const verifications = await VerificationDocument.find({ ownerId: req.userId }).lean();
    const byProperty = new Map(verifications.map((item) => [String(item.propertyId), item]));
    res.json({ properties: properties.map((property) => ({ ...property, verification: byProperty.get(String(property._id)) || null })) });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load owner properties' });
  }
});

module.exports = router;
