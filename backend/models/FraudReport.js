const mongoose = require('mongoose');

const fraudReportSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  reporterId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportType: { type: String, enum: ['fake_listing', 'hidden_charges', 'incorrect_photos', 'broker_fraud', 'already_rented', 'scam_attempt', 'duplicate_listing', 'other'], required: true },
  description: { type: String, required: true, minlength: 50, maxlength: 1000, trim: true },
  evidence: { type: [String], validate: [(files) => files.length <= 5, 'Maximum 5 evidence files are allowed'] },
  severity: { type: String, enum: ['high', 'medium'], required: true },
  status: { type: String, enum: ['pending', 'investigating', 'resolved', 'dismissed'], default: 'pending' },
  adminNotes: String,
  actionTaken: { type: String, enum: ['no_action', 'warning_sent', 'listing_hidden', 'listing_removed', 'account_suspended'], default: 'no_action' },
  reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  resolvedAt: Date,
}, { timestamps: true });

fraudReportSchema.index({ status: 1, createdAt: -1 });
fraudReportSchema.index({ propertyId: 1, reportType: 1 });

fraudReportSchema.pre('validate', function setSeverity(next) {
  this.severity = ['scam_attempt', 'fake_listing'].includes(this.reportType) ? 'high' : 'medium';
  next();
});

module.exports = mongoose.model('FraudReport', fraudReportSchema);