const express = require('express');
const mongoose = require('mongoose');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const Listing = require('../models/Listing');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireTenant } = require('../middleware/roleAuth');
const {
  emitConversationMessage,
  emitConversationUpdated,
  isUserOnline,
  markConversationRead,
  persistSocketMessage,
} = require('../services/socketService');
const { sendNewMessageNotification } = require('../services/notificationService');

const router = express.Router();

const validId = (value) => mongoose.Types.ObjectId.isValid(value);

async function getParticipantConversation(id, userId) {
  if (!validId(id)) return null;
  return Conversation.findOne({
    _id: id,
    isActive: true,
    $or: [{ tenantId: userId }, { ownerId: userId }],
  });
}

// Only tenants can begin a conversation, and it is tied to one listing.
router.post('/start', authMiddleware, requireTenant(), async (req, res) => {
  try {
    const { propertyId } = req.body;
    if (!validId(propertyId)) return res.status(400).json({ msg: 'Valid propertyId is required' });

    const listing = await Listing.findById(propertyId);
    if (!listing) return res.status(404).json({ msg: 'Property not found' });
    if (String(listing.owner_id) === String(req.userId)) {
      return res.status(403).json({ msg: 'You cannot start a conversation about your own property' });
    }

    let conversation = await Conversation.findOne({ propertyId, tenantId: req.userId });
    if (!conversation) {
      try {
        conversation = await Conversation.create({
          propertyId,
          tenantId: req.userId,
          ownerId: listing.owner_id,
        });
      } catch (err) {
        if (err.code !== 11000) throw err;
        conversation = await Conversation.findOne({ propertyId, tenantId: req.userId });
      }
    }

    conversation = await Conversation.findById(conversation._id)
      .populate('propertyId', 'title area city images monthly_rent_bdt owner_id')
      .populate('tenantId', 'name email')
      .populate('ownerId', 'name email');
    res.status(200).json({ conversation });
  } catch (err) {
    console.error('[Conversations] start failed:', err.message);
    res.status(500).json({ msg: 'Unable to start conversation' });
  }
});

// Both participants can list only their own conversations.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      isActive: true,
      $or: [{ tenantId: req.userId }, { ownerId: req.userId }],
    })
      .populate('propertyId', 'title area city images monthly_rent_bdt owner_id')
      .populate('tenantId', 'name email')
      .populate('ownerId', 'name email')
      .populate('lastMessageSenderId', 'name')
      .sort({ lastMessageAt: -1, createdAt: -1 });
    res.json({ conversations });
  } catch (err) {
    console.error('[Conversations] list failed:', err.message);
    res.status(500).json({ msg: 'Unable to load conversations' });
  }
});

router.get('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.userId);
    if (!conversation) return res.status(404).json({ msg: 'Conversation not found' });

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
    const query = { conversationId: conversation._id };
    const [messages, total] = await Promise.all([
      Message.find(query)
        .populate('senderId', 'name email')
        .populate('receiverId', 'name email')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Message.countDocuments(query),
    ]);
    res.json({ messages, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Conversations] messages failed:', err.message);
    res.status(500).json({ msg: 'Unable to load messages' });
  }
});

router.post('/:id/messages', authMiddleware, async (req, res) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.userId);
    if (!conversation) return res.status(404).json({ msg: 'Conversation not found' });

    const { message, receiverId } = await persistSocketMessage(
      req.userId,
      conversation._id,
      req.body.content,
      req.body.messageType
    );
    const populatedMessage = await Message.findById(message._id)
      .populate('senderId', 'name email')
      .populate('receiverId', 'name email');
    emitConversationMessage(conversation._id, populatedMessage);
    emitConversationUpdated(conversation, populatedMessage);

    if (!isUserOnline(receiverId)) {
      const sender = await User.findById(req.userId).select('name');
      const listing = await Listing.findById(conversation.propertyId).select('title');
      void sendNewMessageNotification(receiverId, sender?.name || 'A user', listing?.title || 'your property', message._id);
    }

    res.status(201).json({ message: populatedMessage });
  } catch (err) {
    console.error('[Conversations] send failed:', err.message);
    res.status(err.message === 'Message content is required' ? 400 : 500).json({ msg: err.message });
  }
});

router.put('/:id/read', authMiddleware, async (req, res) => {
  try {
    const conversation = await getParticipantConversation(req.params.id, req.userId);
    if (!conversation) return res.status(404).json({ msg: 'Conversation not found' });
    await markConversationRead(conversation, req.userId);
    res.json({ msg: 'Conversation marked as read' });
  } catch (err) {
    console.error('[Conversations] mark-read failed:', err.message);
    res.status(500).json({ msg: 'Unable to mark conversation as read' });
  }
});

router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const conversations = await Conversation.find({
      isActive: true,
      $or: [{ tenantId: req.userId }, { ownerId: req.userId }],
    }).select('tenantId tenantUnreadCount ownerUnreadCount');
    const unreadCount = conversations.reduce((total, conversation) => {
      const isTenant = String(conversation.tenantId) === String(req.userId);
      return total + (isTenant ? conversation.tenantUnreadCount : conversation.ownerUnreadCount);
    }, 0);
    res.json({ unreadCount });
  } catch (err) {
    console.error('[Conversations] unread-count failed:', err.message);
    res.status(500).json({ msg: 'Unable to load unread count' });
  }
});

module.exports = router;
