const mongoose = require('mongoose');

const PropertyComparisonSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false
  },
  listing_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Listing',
    required: true
  }],
  compared_at: {
    type: Date,
    default: Date.now
  }
});

PropertyComparisonSchema.index({ user_id: 1 });
PropertyComparisonSchema.index({ compared_at: -1 });

module.exports = mongoose.model('PropertyComparison', PropertyComparisonSchema);
