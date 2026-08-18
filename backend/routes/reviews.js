const express = require('express');
const mongoose = require('mongoose');
const path = require('path');
const Review = require('../models/Review');
const Listing = require('../models/Listing');
const User = require('../models/User');
const ViewingAppointment = require('../models/ViewingAppointment');
const RentalApplication = require('../models/RentalApplication');
const { authMiddleware } = require('../middleware/auth');
const { requireTenant, requireOwner } = require('../middleware/roleAuth');
const { evidenceUpload, fraudUploadsRoot } = require('../config/multerConfig');
const { updatePropertyRating, categoryFields } = require('../utils/reviewHelpers');
const { sendReviewNotification, sendReviewResponseNotification } = require('../services/notificationService');

const router = express.Router();
const ratingNames = categoryFields;
const validId = (value) => mongoose.Types.ObjectId.isValid(value);
const backendUrl = () => process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`;
const fileUrl = (file) => `${backendUrl()}/uploads/fraud-reports/${path.relative(fraudUploadsRoot, file.path).replace(/\\/g, '/')}`;

const uploadReviews = (req, res, next) => evidenceUpload.array('photos', 3)(req, res, (err) => {
  if (err) return res.status(400).json({ msg: err.message || 'Invalid review photo upload' });
  next();
});

async function getEligibility(propertyId, reviewerId) {
  const [completedViewing, approvedApplication, existingReview] = await Promise.all([
    ViewingAppointment.exists({ listing_id: propertyId, tenant_id: reviewerId, status: 'completed' }),
    RentalApplication.exists({ listing_id: propertyId, tenant_id: reviewerId, status: 'approved' }),
    Review.findOne({ propertyId, reviewerId }).select('_id status'),
  ]);
  return {
    eligible: Boolean(completedViewing || approvedApplication) && !existingReview,
    reviewType: approvedApplication ? 'rented' : completedViewing ? 'viewing_only' : null,
    hasCompletedViewing: Boolean(completedViewing),
    hasApprovedApplication: Boolean(approvedApplication),
    alreadyReviewed: Boolean(existingReview),
  };
}

router.get('/eligibility/:propertyId', authMiddleware, requireTenant(), async (req, res) => {
  try {
    if (!validId(req.params.propertyId)) return res.status(400).json({ msg: 'Invalid property ID' });
    const listing = await Listing.findById(req.params.propertyId).select('title owner_id');
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    res.json({ ...(await getEligibility(listing._id, req.userId)), property: listing });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to check review eligibility' });
  }
});

router.post('/', authMiddleware, requireTenant(), uploadReviews, async (req, res) => {
  try {
    const listing = await Listing.findById(req.body.propertyId);
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    const eligibility = await getEligibility(listing._id, req.userId);
    if (!eligibility.eligible) return res.status(403).json({ msg: 'You are not eligible to review this property', eligibility });

    const ratings = {};
    for (const field of ratingNames) {
      const value = Number(req.body[field]);
      if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ msg: `${field} must be an integer from 1 to 5` });
      ratings[field] = value;
    }
    const reviewText = req.body.reviewText?.trim();
    if (reviewText && (reviewText.length < 50 || reviewText.length > 500)) return res.status(400).json({ msg: 'Review text must be between 50 and 500 characters' });
    if (req.body.wouldRecommend !== 'true' && req.body.wouldRecommend !== 'false') return res.status(400).json({ msg: 'wouldRecommend is required' });

    const review = await Review.create({
      propertyId: listing._id,
      reviewerId: req.userId,
      ownerId: listing.owner_id,
      ratings,
      reviewText,
      photos: (req.files || []).map(fileUrl),
      wouldRecommend: req.body.wouldRecommend === 'true',
      rentedDuration: req.body.rentedDuration || undefined,
      reviewType: eligibility.reviewType,
    });
    await updatePropertyRating(listing._id);
    const reviewer = await User.findById(req.userId).select('name');
    void sendReviewNotification(listing.owner_id, reviewer?.name || 'A tenant', listing.title, review.overallRating, review._id);
    res.status(201).json({ review });
  } catch (err) {
    console.error('[Reviews] create failed:', err.message);
    res.status(err.code === 11000 ? 409 : 500).json({ msg: err.code === 11000 ? 'You have already reviewed this property' : err.message });
  }
});

router.get('/property/:propertyId', async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, Number.parseInt(req.query.limit, 10) || 10));
    const query = { propertyId: req.params.propertyId, status: 'active' };
    if (req.query.rating) query.overallRating = Number(req.query.rating);
    const sort = req.query.sort === 'highest' ? { overallRating: -1, createdAt: -1 } : req.query.sort === 'lowest' ? { overallRating: 1, createdAt: -1 } : req.query.sort === 'helpful' ? { helpfulCount: -1, createdAt: -1 } : { createdAt: -1 };
    const [reviews, total, listing] = await Promise.all([
      Review.find(query).populate('reviewerId', 'name').sort(sort).skip((page - 1) * limit).limit(limit),
      Review.countDocuments(query),
      Listing.findById(req.params.propertyId).select('averageRating totalReviews ratingBreakdown categoryAverages'),
    ]);
    res.json({ reviews, stats: listing ? { averageRating: listing.averageRating, totalReviews: listing.totalReviews, ratingBreakdown: listing.ratingBreakdown, categoryAverages: listing.categoryAverages } : null, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load reviews' });
  }
});

router.get('/property/:propertyId/stats', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.propertyId).select('averageRating totalReviews ratingBreakdown categoryAverages');
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    const recommendCount = await Review.countDocuments({ propertyId: req.params.propertyId, status: 'active', wouldRecommend: true });
    res.json({ averageRating: listing.averageRating, totalReviews: listing.totalReviews, recommendPercent: listing.totalReviews ? Math.round(recommendCount / listing.totalReviews * 100) : 0, ratingBreakdown: listing.ratingBreakdown, categoryAverages: listing.categoryAverages });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to load rating statistics' });
  }
});

router.put('/:id', authMiddleware, requireTenant(), async (req, res) => {
  try {
    const review = await Review.findOne({ _id: req.params.id, reviewerId: req.userId });
    if (!review) return res.status(404).json({ msg: 'Review not found' });
    if (Date.now() - review.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) return res.status(403).json({ msg: 'Reviews can only be edited within 7 days' });
    for (const field of ratingNames) {
      if (req.body[field] !== undefined) {
        const value = Number(req.body[field]);
        if (!Number.isInteger(value) || value < 1 || value > 5) return res.status(400).json({ msg: `${field} must be an integer from 1 to 5` });
        review.ratings[field] = value;
      }
    }
    if (req.body.reviewText !== undefined) {
      const text = String(req.body.reviewText).trim();
      if (text && (text.length < 50 || text.length > 500)) return res.status(400).json({ msg: 'Review text must be between 50 and 500 characters' });
      review.reviewText = text;
    }
    if (req.body.wouldRecommend !== undefined) review.wouldRecommend = Boolean(req.body.wouldRecommend);
    await review.save();
    await updatePropertyRating(review.propertyId);
    res.json({ review });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to update review' });
  }
});

router.post('/:id/helpful', authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ msg: 'Review not found' });
    const index = review.helpfulBy.findIndex((id) => String(id) === String(req.userId));
    if (index >= 0) { review.helpfulBy.splice(index, 1); review.helpfulCount = Math.max(0, review.helpfulCount - 1); } else { review.helpfulBy.push(req.userId); review.helpfulCount += 1; }
    await review.save();
    res.json({ helpful: index < 0, helpfulCount: review.helpfulCount });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to update helpful vote' });
  }
});

router.post('/:id/owner-response', authMiddleware, requireOwner(), async (req, res) => {
  try {
    const text = String(req.body.text || '').trim();
    if (text.length < 1 || text.length > 500) return res.status(400).json({ msg: 'Response must be 1 to 500 characters' });
    const review = await Review.findById(req.params.id).populate('propertyId', 'title owner_id');
    if (!review) return res.status(404).json({ msg: 'Review not found' });
    if (String(review.ownerId) !== String(req.userId) || String(review.propertyId.owner_id) !== String(req.userId)) return res.status(403).json({ msg: 'Not authorized to respond' });
    if (review.ownerResponse?.respondedAt) return res.status(409).json({ msg: 'This review already has an owner response' });
    review.ownerResponse = { text, respondedAt: new Date() };
    await review.save();
    const owner = await User.findById(req.userId).select('name');
    void sendReviewResponseNotification(review.reviewerId, review.propertyId.title, owner?.name || 'The owner', review._id);
    res.json({ review });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to respond to review' });
  }
});

router.post('/:id/report', authMiddleware, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ msg: 'Review not found' });
    if (!review.reportedBy.some((id) => String(id) === String(req.userId))) {
      review.reportedBy.push(req.userId);
      review.reportedCount += 1;
      if (review.reportedCount > 5) review.status = 'hidden';
      await review.save();
    }
    res.json({ reportedCount: review.reportedCount, status: review.status });
  } catch (err) {
    res.status(500).json({ msg: 'Unable to report review' });
  }
});

module.exports = router;
