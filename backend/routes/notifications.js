const express = require('express');
const router = express.Router();
const Notification = require('../models/Notification');
const { authMiddleware } = require('../middleware/auth');

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