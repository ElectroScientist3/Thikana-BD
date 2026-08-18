const mongoose = require('mongoose');

const ratingFields = ['listingAccuracy', 'ownerCommunication', 'cleanliness', 'safety', 'location', 'valueForMoney'];

const reviewSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  reviewerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ratings: {
    listingAccuracy: { type: Number, min: 1, max: 5, required: true },
    ownerCommunication: { type: Number, min: 1, max: 5, required: true },
    cleanliness: { type: Number, min: 1, max: 5, required: true },
    safety: { type: Number, min: 1, max: 5, required: true },
    location: { type: Number, min: 1, max: 5, required: true },
    valueForMoney: { type: Number, min: 1, max: 5, required: true },
  },
  overallRating: { type: Number, min: 1, max: 5, required: true },
  reviewText: { type: String, trim: true, minlength: 50, maxlength: 500 },
  photos: { type: [String], validate: [(photos) => photos.length <= 3, 'Maximum 3 review photos are allowed'] },
  wouldRecommend: { type: Boolean, required: true },
  rentedDuration: { type: String, enum: ['less_than_3_months', '3_to_6_months', '6_to_12_months', 'more_than_1_year'] },
  reviewType: { type: String, enum: ['viewing_only', 'rented'], required: true },
  ownerResponse: { text: { type: String, maxlength: 500 }, respondedAt: Date },
  helpfulCount: { type: Number, default: 0 },
  helpfulBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  reportedCount: { type: Number, default: 0 },
  reportedBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  status: { type: String, enum: ['active', 'hidden', 'under_review', 'removed'], default: 'active' },
}, { timestamps: true });

reviewSchema.index({ propertyId: 1, reviewerId: 1 }, { unique: true });
reviewSchema.index({ propertyId: 1, status: 1, createdAt: -1 });

reviewSchema.pre('validate', function calculateOverallRating(next) {
  if (this.ratings) {
    const values = ratingFields.map((field) => Number(this.ratings[field]));
    if (values.every((value) => Number.isFinite(value))) this.overallRating = Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10;
  }
  next();
});

module.exports = mongoose.model('Review', reviewSchema);