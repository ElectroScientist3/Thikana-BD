const mongoose = require('mongoose');

const verificationDocumentSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true, unique: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  documents: {
    utilityBill: String,
    ownershipDoc: String,
    nidFront: String,
    nidBack: String,
    addressProof: String,
    propertyPhotos: { type: [String], validate: [(photos) => photos.length >= 3, 'At least 3 property photos are required'] },
  },
  mobileVerification: {
    verified: { type: Boolean, default: false },
    phone: String,
    otp: String,
    otpExpiresAt: Date,
    verifiedAt: Date,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'under_review', 'approved', 'rejected', 'requires_more_info'],
    default: 'pending',
  },
  rejectionReason: String,
  reviewNotes: String,
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  submittedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
}, { timestamps: true });

verificationDocumentSchema.index({ ownerId: 1, verificationStatus: 1 });

module.exports = mongoose.model('VerificationDocument', verificationDocumentSchema);