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
      'viewing_cancelled',
      'viewing_completed',
      // Rental application notifications
      'application_submitted',
      'application_approved',
      'application_rejected',
      'application_status_updated',
      'application_withdrawn',
      'application_sent',
      'rent_due',
      'rent_payment_requested',
      'rent_payment_approved',
      'rent_payment_rejected',
      'rent_overdue',
      'maintenance_issue_submitted',
      'maintenance_status_updated',
      'move_out_requested',
      'move_out_accepted',
      'move_out_rejected'
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