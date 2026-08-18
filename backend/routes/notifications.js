const express = require('express');
const crypto = require('crypto');
const router = express.Router();
const Notification = require('../models/Notification');
const NotificationLog = require('../models/NotificationLog');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireRole } = require('../middleware/roleAuth');
const { sendMessage } = require('../services/telegramBot');

const allRoles = requireRole('tenant', 'owner', 'admin');

const getTelegramBotLink = () => {
  const username = process.env.TELEGRAM_BOT_USERNAME;
  return username ? `https://t.me/${username.replace(/^@/, '')}` : null;
};

// Generate a short-lived code that the user sends to the Telegram bot.
router.post('/telegram/generate-code', authMiddleware, allRoles, async (req, res) => {
  try {
    const code = crypto.randomInt(100000, 1000000).toString();
    const expiry = new Date(Date.now() + 10 * 60 * 1000);
    await User.findByIdAndUpdate(req.userId, {
      telegramVerificationCode: code,
      telegramCodeExpiry: expiry,
    });
    res.json({ code, expiresAt: expiry, botLink: getTelegramBotLink() });
  } catch (err) {
    console.error('[Telegram] generate-code failed:', err.message);
    res.status(500).json({ msg: 'Unable to generate Telegram verification code' });
  }
});

router.post('/telegram/unlink', authMiddleware, allRoles, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, {
      telegramChatId: undefined,
      telegramLinked: false,
      telegramVerificationCode: undefined,
      telegramCodeExpiry: undefined,
    });
    res.json({ msg: 'Telegram unlinked successfully' });
  } catch (err) {
    console.error('[Telegram] unlink failed:', err.message);
    res.status(500).json({ msg: 'Unable to unlink Telegram' });
  }
});

router.get('/status', authMiddleware, allRoles, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('telegramLinked notificationLanguage notificationsEnabled');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({
      linked: Boolean(user.telegramLinked),
      language: user.notificationLanguage || 'en',
      enabled: user.notificationsEnabled !== false,
    });
  } catch (err) {
    console.error('[Telegram] status failed:', err.message);
    res.status(500).json({ msg: 'Unable to load notification status' });
  }
});

router.get('/history', authMiddleware, allRoles, async (req, res) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const query = { userId: req.userId };
    if (req.query.type) query.type = req.query.type;
    if (req.query.status && ['sent', 'failed', 'pending'].includes(req.query.status)) {
      query.status = req.query.status;
    }
    const [logs, total] = await Promise.all([
      NotificationLog.find(query).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit),
      NotificationLog.countDocuments(query),
    ]);
    res.json({ logs, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[Telegram] history failed:', err.message);
    res.status(500).json({ msg: 'Unable to load notification history' });
  }
});

router.put('/preferences', authMiddleware, allRoles, async (req, res) => {
  try {
    const updates = {};
    if (req.body.language !== undefined) {
      if (!['en', 'bn'].includes(req.body.language)) return res.status(400).json({ msg: 'Language must be en or bn' });
      updates.notificationLanguage = req.body.language;
    }
    if (req.body.enabled !== undefined) {
      if (typeof req.body.enabled !== 'boolean') return res.status(400).json({ msg: 'Enabled must be boolean' });
      updates.notificationsEnabled = req.body.enabled;
    }
    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true })
      .select('telegramLinked notificationLanguage notificationsEnabled');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({
      linked: Boolean(user.telegramLinked),
      language: user.notificationLanguage || 'en',
      enabled: user.notificationsEnabled !== false,
    });
  } catch (err) {
    console.error('[Telegram] preferences failed:', err.message);
    res.status(500).json({ msg: 'Unable to update notification preferences' });
  }
});

router.post('/test', authMiddleware, allRoles, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('telegramChatId telegramLinked notificationsEnabled notificationLanguage');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    if (!user.telegramLinked || !user.notificationsEnabled || !user.telegramChatId) {
      return res.status(400).json({ msg: 'Link Telegram and enable notifications first' });
    }
    const language = user.notificationLanguage || 'en';
    const message = language === 'bn'
      ? 'ThikanaBD test notification received successfully.'
      : 'ThikanaBD test notification received successfully.';
    const telegramMessage = await sendMessage(user.telegramChatId, message);
    const status = telegramMessage ? 'sent' : 'failed';
    await NotificationLog.create({
      userId: req.userId,
      type: 'new_message',
      title: 'Telegram test',
      message,
      language,
      status,
      telegramMessageId: telegramMessage ? String(telegramMessage.message_id) : undefined,
      errorMessage: telegramMessage ? undefined : 'Telegram send failed',
    });
    if (!telegramMessage) return res.status(502).json({ msg: 'Telegram test message failed' });
    res.json({ msg: 'Test notification sent successfully' });
  } catch (err) {
    console.error('[Telegram] test failed:', err.message);
    res.status(500).json({ msg: 'Unable to send Telegram test notification' });
  }
});

// Get user's notifications
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { limit = 20, page = 1, unreadOnly = false } = req.query;
    
    const query = { user_id: req.userId };
    if (unreadOnly === 'true') {
      query.read = false;
    }
    
    const notifications = await Notification.find(query)
      .sort({ created_at: -1 })
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));
      
    const total = await Notification.countDocuments(query);
    const unreadCount = await Notification.countDocuments({ 
      user_id: req.userId, 
      read: false 
    });
    
    res.json({
      notifications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      },
      unreadCount
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Mark notification as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      user_id: req.userId
    });
    
    if (!notification) {
      return res.status(404).json({ msg: 'Notification not found' });
    }
    
    notification.read = true;
    notification.read_at = new Date();
    await notification.save();
    
    res.json({ msg: 'Notification marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Mark all notifications as read
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await Notification.updateMany(
      { user_id: req.userId, read: false },
      { read: true, read_at: new Date() }
    );
    
    res.json({ msg: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;