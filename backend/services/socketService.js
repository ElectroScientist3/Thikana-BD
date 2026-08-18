const jwt = require('jsonwebtoken');
const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Listing = require('../models/Listing');
const { sendNewMessageNotification } = require('./notificationService');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';
const onlineUsers = new Map();
let io = null;

const getToken = (socket) => {
  const authToken = socket.handshake.auth?.token;
  const header = socket.handshake.headers?.authorization || socket.handshake.headers?.Authorization;
  const headerToken = header?.startsWith('Bearer ') ? header.slice(7).trim() : header;
  return authToken || headerToken;
};

const participantRole = (conversation, userId) => {
  if (String(conversation.tenantId) === String(userId)) return 'tenant';
  if (String(conversation.ownerId) === String(userId)) return 'owner';
  return null;
};

const sanitizeContent = (value) => String(value || '')
  .replace(/<[^>]*>/g, '')
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
  .trim()
  .slice(0, 2000);

async function markConversationRead(conversation, userId) {
  const role = participantRole(conversation, userId);
  if (!role) return false;

  await Message.updateMany(
    { conversationId: conversation._id, receiverId: userId, isRead: false },
    { isRead: true, readAt: new Date() }
  );
  await Conversation.updateOne(
    { _id: conversation._id },
    role === 'tenant' ? { tenantUnreadCount: 0 } : { ownerUnreadCount: 0 }
  );
  if (io) {
    io.to(`conversation:${conversation._id}`).emit('messages-read', { conversationId: conversation._id, userId });
    io.to(`user:${conversation.tenantId}`).emit('conversation-read', { conversationId: conversation._id });
    io.to(`user:${conversation.ownerId}`).emit('conversation-read', { conversationId: conversation._id });
  }
  return true;
}

async function persistSocketMessage(userId, conversationId, content, messageType = 'text') {
  const conversation = await Conversation.findOne({ _id: conversationId, isActive: true });
  if (!conversation) throw new Error('Conversation not found');
  const role = participantRole(conversation, userId);
  if (!role) throw new Error('You are not a participant in this conversation');

  const cleanContent = sanitizeContent(content);
  if (!cleanContent) throw new Error('Message content is required');
  const receiverId = role === 'tenant' ? conversation.ownerId : conversation.tenantId;
  const message = await Message.create({
    conversationId: conversation._id,
    senderId: userId,
    receiverId,
    content: cleanContent,
    messageType: ['text', 'system'].includes(messageType) ? messageType : 'text',
  });

  const unreadField = role === 'tenant' ? 'ownerUnreadCount' : 'tenantUnreadCount';
  await Conversation.updateOne(
    { _id: conversation._id },
    {
      lastMessage: cleanContent,
      lastMessageAt: message.createdAt,
      lastMessageSenderId: userId,
      $inc: { [unreadField]: 1 },
    }
  );

  return { conversation, message, receiverId };
}

function emitConversationMessage(conversationId, message) {
  if (io) io.to(`conversation:${conversationId}`).emit('new-message', message);
}

function emitConversationUpdated(conversation, message) {
  if (!io) return;
  const payload = { conversationId: conversation._id, message };
  io.to(`user:${conversation.tenantId}`).emit('conversation-updated', payload);
  io.to(`user:${conversation.ownerId}`).emit('conversation-updated', payload);
}

function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

function initSocketIO(httpServer) {
  const { Server } = require('socket.io');
  io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:5173',
      credentials: true,
    },
  });

  io.use((socket, next) => {
    try {
      const token = getToken(socket);
      if (!token) return next(new Error('Authentication required'));
      const decoded = jwt.verify(token, JWT_SECRET);
      socket.userId = String(decoded.id);
      next();
    } catch (err) {
      console.error('[Socket] authentication failed:', err.message);
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    onlineUsers.set(socket.userId, socket.id);
    socket.join(`user:${socket.userId}`);
    socket.emit('online-users', Array.from(onlineUsers.keys()));
    io.emit('user-online', socket.userId);
    console.log(`[Socket] connected user=${socket.userId} socket=${socket.id}`);

    socket.on('join-conversation', async (conversationId, callback) => {
      try {
        const conversation = await Conversation.findOne({ _id: conversationId, isActive: true });
        if (!conversation || !participantRole(conversation, socket.userId)) throw new Error('Conversation access denied');
        await markConversationRead(conversation, socket.userId);
        socket.join(`conversation:${conversationId}`);
        socket.emit('conversation-joined', { conversationId });
        if (callback) callback({ ok: true });
      } catch (err) {
        console.error('[Socket] join-conversation failed:', err.message);
        if (callback) callback({ ok: false, error: err.message });
        socket.emit('messaging-error', { event: 'join-conversation', message: err.message });
      }
    });

    socket.on('leave-conversation', (conversationId) => {
      socket.leave(`conversation:${conversationId}`);
    });

    socket.on('send-message', async (payload, callback) => {
      try {
        const { conversation, message, receiverId } = await persistSocketMessage(
          socket.userId,
          payload?.conversationId,
          payload?.content,
          payload?.messageType
        );
        const populatedMessage = await Message.findById(message._id)
          .populate('senderId', 'name email')
          .populate('receiverId', 'name email');
        emitConversationMessage(conversation._id, populatedMessage);
        emitConversationUpdated(conversation, populatedMessage);
        if (!isUserOnline(receiverId)) {
          const sender = await User.findById(socket.userId).select('name');
          const listing = await Listing.findById(conversation.propertyId).select('title');
          void sendNewMessageNotification(receiverId, sender?.name || 'A user', listing?.title || 'your property', message._id);
        }
        if (callback) callback({ ok: true, message: populatedMessage });
      } catch (err) {
        console.error('[Socket] send-message failed:', err.message);
        if (callback) callback({ ok: false, error: err.message });
        socket.emit('messaging-error', { event: 'send-message', message: err.message });
      }
    });

    socket.on('typing', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user-typing', { userId: socket.userId });
    });

    socket.on('stop-typing', (conversationId) => {
      socket.to(`conversation:${conversationId}`).emit('user-stop-typing', { userId: socket.userId });
    });

    socket.on('disconnect', (reason) => {
      if (onlineUsers.get(socket.userId) === socket.id) onlineUsers.delete(socket.userId);
      io.emit('user-offline', socket.userId);
      console.log(`[Socket] disconnected user=${socket.userId} reason=${reason}`);
    });
  });

  return io;
}

module.exports = {
  initSocketIO,
  isUserOnline,
  emitConversationMessage,
  emitConversationUpdated,
  persistSocketMessage,
  markConversationRead,
};
