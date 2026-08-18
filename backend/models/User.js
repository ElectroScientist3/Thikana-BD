const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  phone: String,
  homeAddress: String,
  currentLocation: String,
  familyStatus: String,
  role: {
    type: String,
    enum: ['tenant', 'owner', 'admin'],
    required: true,
  },
  verificationStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'approved', 'rejected'],
  },
  verificationDocuments: [{ type: String }],
  verificationNotes: String,
  businessName: String,
  preferredContactMethod: String,
  telegramChatId: String,
  telegramLinked: { type: Boolean, default: false },
  telegramVerificationCode: String,
  telegramCodeExpiry: Date,
  notificationLanguage: { type: String, enum: ['en', 'bn'], default: 'en' },
  notificationsEnabled: { type: Boolean, default: true },
  isSuspended: { type: Boolean, default: false },
  tokens: { type: Number, default: 0 },
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
