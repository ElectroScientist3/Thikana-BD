const mongoose = require('mongoose');

const ListingSchema = new mongoose.Schema({
  title: { type: String, required: true },
  description: String,
  city: String,
  area: String,
  monthly_rent_bdt: Number,
  advance_bdt: Number,
  property_type: String,
  rooms: Number,
  available_from: Date,
  coords: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], index: '2dsphere' },
  },
  images: [String],
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  utilities: {
    wifi: Boolean,
    lift: Boolean,
    parking: Boolean,
    gas: Boolean,
    water: Boolean,
    electricity: String,
  },
}, { timestamps: true });

module.exports = mongoose.model('Listing', ListingSchema);
