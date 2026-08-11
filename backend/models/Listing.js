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
  owner_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  utilities: {
    wifi: Boolean,
    lift: Boolean,
    parking: Boolean,
    gas: Boolean,
    water: Boolean,
    electricity: String,
  },
  // NEW FIELDS FOR UNIT STATUS MANAGEMENT
  status: {
    type: String,
    enum: ['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'],
    default: 'available_now'
  },
  status_updated_at: { type: Date, default: Date.now },
  hold_expiry_date: Date, // For 'on_hold' status - auto-expiry
  reservation_expiry_date: Date, // For 'reserved' status - auto-expiry
  rented_to_user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, // For 'rented' status
  rented_at: Date, // When status changed to 'rented'
  status_history: [{
    status: {
      type: String,
      enum: ['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented']
    },
    changed_at: { type: Date, default: Date.now },
    changed_by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    notes: String
  }]
}, { timestamps: true });

// Index for efficient queries
ListingSchema.index({ status: 1 });
ListingSchema.index({ owner_id: 1, status: 1 });
ListingSchema.index({ available_from: 1 });
ListingSchema.index({ 'coords.coordinates': '2dsphere' });

// Virtual for checking if listing is available to show to tenants
ListingSchema.virtual('is_available_to_tenant').get(function() {
  if (this.status === 'rented') return false;
  if (this.status === 'reserved' && this.reservation_expiry_date) {
    return new Date() > this.reservation_expiry_date;
  }
  if (this.status === 'on_hold' && this.hold_expiry_date) {
    return new Date() > this.hold_expiry_date;
  }
  return this.status === 'available_now' || this.status === 'available_from_date';
});

// Method to update status with history
ListingSchema.methods.updateStatus = async function(newStatus, userId, notes = '') {
  const oldStatus = this.status;
  this.status = newStatus;
  this.status_updated_at = new Date();
  
  // Add to history
  this.status_history.push({
    status: newStatus,
    changed_at: new Date(),
    changed_by: userId,
    notes
  });
  
  // Handle special cases
  if (newStatus === 'rented') {
    this.rented_at = new Date();
  }
  
  if (newStatus === 'available_now') {
    this.available_from = new Date();
  }
  
  await this.save();
  return { oldStatus, newStatus };
};

// Method to check if a listing is available for viewing by tenants
ListingSchema.methods.isVisibleToTenant = function() {
  if (this.status === 'rented') return false;
  if (this.status === 'reserved') {
    return this.reservation_expiry_date ? new Date() > this.reservation_expiry_date : false;
  }
  if (this.status === 'on_hold') {
    return this.hold_expiry_date ? new Date() > this.hold_expiry_date : false;
  }
  return ['available_now', 'available_from_date'].includes(this.status);
};

module.exports = mongoose.model('Listing', ListingSchema);