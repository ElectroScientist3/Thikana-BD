// models/Notification.js
const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema({
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  listing_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  type: {
    type: String,
    enum: [
      // Property status notifications
      'status_changed',
      'hold_expiring',
      'reservation_expiring',
      'rented_confirmation',
      'listing_available',
      // Viewing appointment notifications
      'viewing_requested',
      'viewing_approved',
      'viewing_rejected',
      'viewing_rescheduled',
      'reschedule_accepted',
      'viewing_cancelled'
    ],
    required: true
  },
  message: { type: String, required: true },
  read: { type: Boolean, default: false },
  read_at: Date,
  data: { type: mongoose.Schema.Types.Mixed },
  created_at: { type: Date, default: Date.now }
});

NotificationSchema.index({ user_id: 1, read: 1 });
NotificationSchema.index({ created_at: -1 });

module.exports = mongoose.model('Notification', NotificationSchema);