const mongoose = require('mongoose');

const RentalAgreementSchema = new mongoose.Schema({
  agreementNumber: { type: String, required: true, unique: true, index: true },
  booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true, unique: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  monthlyRent: { type: Number, default: 0 },
  advancePaid: { type: Number, default: 0 },
  startDate: { type: Date, default: Date.now },
  status: { type: String, enum: ['Active', 'Terminated'], default: 'Active' },
  generatedAt: { type: Date, default: Date.now },
  ownerInfo: {
    name: String,
    email: String,
    phone: String,
  },
  tenantInfo: {
    name: String,
    email: String,
    phone: String,
  },
  propertyAddress: String,
  serviceCharge: { type: Number, default: 2500 },
  utilitiesCharge: { type: Number, default: 1000 },
  leaseDuration: { type: String, default: '1_year' },
  dueDate: Date,
  noticePeriodDays: { type: Number, default: 30 },
  utilities: {
    tenantResponsibilities: [String],
    ownerResponsibilities: [String],
  },
}, { timestamps: true });

RentalAgreementSchema.index({ tenant: 1, status: 1 });
RentalAgreementSchema.index({ owner: 1, status: 1 });

module.exports = mongoose.model('RentalAgreement', RentalAgreementSchema);
