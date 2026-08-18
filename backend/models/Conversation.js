const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
  propertyId: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing', required: true },
  tenantId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lastMessage: { type: String, default: '' },
  lastMessageAt: Date,
  lastMessageSenderId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  tenantUnreadCount: { type: Number, default: 0 },
  ownerUnreadCount: { type: Number, default: 0 },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

conversationSchema.index({ propertyId: 1, tenantId: 1 }, { unique: true });
conversationSchema.index({ tenantId: 1, lastMessageAt: -1 });
conversationSchema.index({ ownerId: 1, lastMessageAt: -1 });

module.exports = mongoose.model('Conversation', conversationSchema);
