const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const { requireOwner } = require('../middleware/roleAuth');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

// Auth middleware
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  if (!token) return res.status(401).json({ msg: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

router.use(authMiddleware, requireOwner());

// Get owner's dashboard statistics
router.get('/dashboard/stats', authMiddleware, async (req, res) => {
  try {
    const statusCounts = await Listing.aggregate([
      { $match: { owner_id: req.userId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]);

    const total = await Listing.countDocuments({ owner_id: req.userId });

    const byStatus = {
      available_now: 0,
      available_from_date: 0,
      on_hold: 0,
      reserved: 0,
      rented: 0
    };

    statusCounts.forEach(item => {
      if (byStatus[item._id] !== undefined) {
        byStatus[item._id] = item.count;
      }
    });

    res.json({
      total: total,
      byStatus: byStatus
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Bulk update listing statuses
router.patch('/bulk-status', authMiddleware, async (req, res) => {
  try {
    const { listingIds, status, notes } = req.body;
    
    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return res.status(400).json({ msg: 'Listing IDs are required' });
    }
    
    if (!status || !['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }

    const listings = await Listing.find({
      _id: { $in: listingIds },
      owner_id: req.userId
    });

    if (listings.length !== listingIds.length) {
      return res.status(403).json({ msg: 'Some listings do not belong to you' });
    }

    const updatedListings = [];
    for (const listing of listings) {
      await listing.updateStatus(status, req.userId, notes || 'Bulk status update');
      updatedListings.push(listing);
    }

    res.json({ 
      msg: `Updated ${updatedListings.length} listings to ${status}`,
      updatedCount: updatedListings.length 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get status history for a listing
router.get('/:id/history', authMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .select('status_history title')
      .populate('status_history.changed_by', 'name email');

    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }

    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized' });
    }

    res.json({
      listingId: listing._id,
      title: listing.title,
      history: listing.status_history
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get available tenants (for renting)
router.get('/available-tenants', authMiddleware, async (req, res) => {
  try {
    const tenants = await User.find({
      _id: { $ne: req.userId },
    }).select('name email phone currentLocation familyStatus');
    
    res.json({ tenants });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get expired statuses (for cleanup/notification)
router.get('/expired-holds', authMiddleware, async (req, res) => {
  try {
    const expiredHolds = await Listing.find({
      owner_id: req.userId,
      status: 'on_hold',
      hold_expiry_date: { $lt: new Date() }
    }).select('title hold_expiry_date status');

    const expiredReservations = await Listing.find({
      owner_id: req.userId,
      status: 'reserved',
      reservation_expiry_date: { $lt: new Date() }
    }).select('title reservation_expiry_date status');

    res.json({
      expiredHolds,
      expiredReservations
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;