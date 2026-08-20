const mongoose = require('mongoose');

const RentLedgerEntrySchema = new mongoose.Schema({
  agreement: { type: mongoose.Schema.Types.ObjectId, ref: 'RentalAgreement', required: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  period: { type: String, required: true },
  dueDate: { type: Date, required: true },
  rent: { type: Number, default: 0 },
  serviceCharge: { type: Number, default: 2500 },
  utilities: { type: Number, default: 1000 },
  totalDue: { type: Number, default: 0 },
  paidAmount: { type: Number, default: 0 },
  paymentHistory: [{
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    transactionId: String,
    amount: { type: Number, required: true, min: 0 },
    paidAt: { type: Date, default: Date.now },
    status: { type: String, default: 'Completed' },
  }],
  status: { type: String, enum: ['Unpaid', 'Partially Paid', 'Paid', 'Overdue'], default: 'Unpaid' },
  note: String,
}, { timestamps: true });

RentLedgerEntrySchema.index({ agreement: 1, period: 1 }, { unique: true });
RentLedgerEntrySchema.index({ tenant: 1, period: 1 });
RentLedgerEntrySchema.index({ owner: 1, period: 1 });

module.exports = mongoose.model('RentLedgerEntry', RentLedgerEntrySchema);
