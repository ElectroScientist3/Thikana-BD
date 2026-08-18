const mongoose = require('mongoose');

const notificationLogSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  type: {
    type: String,
    enum: [
      'viewing_request',
      'viewing_response',
      'application_status',
      'payment_confirmation',
      'rent_reminder',
      'new_message',
      'maintenance_update',
      'verification_status',
      'review_received',
      'fraud_report',
    ],
    required: true,
  },
  title: { type: String, required: true },
  message: { type: String, required: true },
  language: { type: String, enum: ['en', 'bn'], required: true },
  status: { type: String, enum: ['sent', 'failed', 'pending'], required: true },
  telegramMessageId: String,
  errorMessage: String,
  relatedEntityId: mongoose.Schema.Types.ObjectId,
}, { timestamps: true });

notificationLogSchema.index({ userId: 1, createdAt: -1 });
notificationLogSchema.index({ userId: 1, type: 1, createdAt: -1 });

module.exports = mongoose.model('NotificationLog', notificationLogSchema);