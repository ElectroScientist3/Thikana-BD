// models/ApplicationComparison.js
const mongoose = require('mongoose');

const ApplicationComparisonSchema = new mongoose.Schema({
  owner_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  listing_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  },
  application_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RentalApplication'
  }],
  name: {
    type: String,
    default: 'Untitled Comparison'
  },
  notes: {
    type: String,
    maxlength: 500
  },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

ApplicationComparisonSchema.index({ owner_id: 1, listing_id: 1 });
ApplicationComparisonSchema.index({ created_at: -1 });

module.exports = mongoose.model('ApplicationComparison', ApplicationComparisonSchema);