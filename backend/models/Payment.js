const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  bookingId: { type: String },
  purpose: { type: String, enum: ['booking', 'tokens', 'other'], default: 'other' },
  amount: { type: Number, required: true },
  currency: { type: String, default: 'BDT' },
  tran_id: { type: String },
  transactionId: { type: String },
  store_order_id: { type: String },
  status: { type: String, enum: ['Initiated', 'Completed', 'Failed', 'Canceled'], default: 'Initiated' },
  gateway_response: { type: mongoose.Schema.Types.Mixed },
  meta: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: true });

PaymentSchema.index({ transactionId: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model('Payment', PaymentSchema);
