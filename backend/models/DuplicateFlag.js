const mongoose = require('mongoose');

const duplicateFlagSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  suspectedDuplicateOf: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  similarityScores: {
    phone: { type: Number, default: 0 },
    address: { type: Number, default: 0 },
    coordinates: { type: Number, default: 0 },
    title: { type: Number, default: 0 },
    description: { type: Number, default: 0 },
    images: { type: Number, default: 0 },
  },
  overallSimilarity: { type: Number, min: 0, max: 100, required: true },
  similarityTypes: [String],
  status: {
    type: String,
    enum: ['pending_review', 'confirmed_duplicate', 'not_duplicate', 'dismissed'],
    default: 'pending_review',
  },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  reviewNotes: String,
}, { timestamps: true });

duplicateFlagSchema.index({ propertyId: 1, suspectedDuplicateOf: 1 }, { unique: true });
duplicateFlagSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('DuplicateFlag', duplicateFlagSchema);