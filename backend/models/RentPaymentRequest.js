const mongoose = require('mongoose');

const RentPaymentRequestSchema = new mongoose.Schema({
  ledgerEntry: { type: mongoose.Schema.Types.ObjectId, ref: 'RentLedgerEntry', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 0 },
  status: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
  note: String,
  approvedAt: Date,
  rejectedAt: Date,
}, { timestamps: true });

RentPaymentRequestSchema.index({ owner: 1, status: 1, createdAt: -1 });
RentPaymentRequestSchema.index({ tenant: 1, createdAt: -1 });

module.exports = mongoose.model('RentPaymentRequest', RentPaymentRequestSchema);
