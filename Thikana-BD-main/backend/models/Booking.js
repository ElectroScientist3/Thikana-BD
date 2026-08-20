const mongoose = require('mongoose');

const BookingSchema = new mongoose.Schema({
  bookingToken: { type: String, required: true, unique: true, index: true },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  viewingAppointment: { type: mongoose.Schema.Types.ObjectId, ref: 'ViewingAppointment', unique: true, sparse: true },
  amount: { type: Number, required: true, min: 0 },
  currency: { type: String, default: 'BDT' },
  status: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Canceled'], default: 'Pending' },
  payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment', default: null },
  paidAt: Date,
  moveInDate: Date,
  leaseDuration: { type: String, default: '1_year' },
}, { timestamps: true });

BookingSchema.index({ tenant: 1, status: 1 });
BookingSchema.index({ owner: 1, status: 1 });

module.exports = mongoose.model('Booking', BookingSchema);
