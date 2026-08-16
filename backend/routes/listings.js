const express = require('express');
const router = express.Router();
const Listing = require('../models/Listing');
const jwt = require('jsonwebtoken');

const { computeMatchScore, recommendListings } = require('../utils/recommend');

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

// GET all listings (for tenants - only show available ones)
router.get('/', async (req, res) => {
  try {
    const q = {};
    
    // Filter by availability for tenants
    const isAuthenticated = req.headers.authorization || req.headers.Authorization;
    let userRole = 'tenant';
    
    if (isAuthenticated) {
      try {
        const token = isAuthenticated?.startsWith('Bearer ') ? isAuthenticated.slice(7).trim() : isAuthenticated;
        const decoded = jwt.verify(token, JWT_SECRET);
        req.userId = decoded.id;
        // If user is logged in, we'll show all listings but filter based on status
      } catch (e) {
        // Invalid token, treat as tenant
      }
    }
    
    // If user is not authenticated or is a tenant, filter available listings
    if (!req.userId) {
      // Tenants see only available listings
      q.$or = [
        { status: 'available_now' },
        { 
          status: 'available_from_date',
          available_from: { $lte: new Date() }
        },
        {
          status: 'reserved',
          reservation_expiry_date: { $lt: new Date() }
        },
        {
          status: 'on_hold',
          hold_expiry_date: { $lt: new Date() }
        }
      ];
    }
    
    // Additional filters
    if (req.query.min_rent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $gte: Number(req.query.min_rent) };
    if (req.query.max_rent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $lte: Number(req.query.max_rent) };
    if (req.query.property_type) q.property_type = req.query.property_type;
    if (req.query.city) q.city = req.query.city;
    if (req.query.area) q.area = req.query.area;
    
    // Only filter by status for tenants if not authenticated
    if (!req.userId) {
      // Already handled above
    }

    if (req.query.neLat && req.query.neLng && req.query.swLat && req.query.swLng) {
      const ne = [Number(req.query.neLng), Number(req.query.neLat)];
      const sw = [Number(req.query.swLng), Number(req.query.swLat)];
      q.coords = {
        $geoWithin: {
          $box: [sw, ne],
        },
      };
    }

    const listings = await Listing.find(q)
      .populate('owner_id', 'name email phone')
      .limit(100)
      .sort({ createdAt: -1 });
      
    res.json(listings);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// POST recommendations based on tenant preferences
router.post('/recommend', async (req, res) => {
  try {
    const prefs = req.body || {};
    const limit = prefs.limit ? Math.min(100, Number(prefs.limit)) : 20;

    // Base query: only listings visible to tenants
    const q = {
      $or: [
        { status: 'available_now' },
        { status: 'available_from_date', available_from: { $lte: new Date() } },
        { status: 'reserved', reservation_expiry_date: { $lt: new Date() } },
        { status: 'on_hold', hold_expiry_date: { $lt: new Date() } }
      ]
    };

    // Apply some filters to reduce candidate set
    if (prefs.city) q.city = prefs.city;
    if (prefs.area) q.area = prefs.area;
    if (prefs.propertyType) q.property_type = prefs.propertyType;
    if (prefs.maxRent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $lte: Number(prefs.maxRent) };
    if (prefs.minRent) q.monthly_rent_bdt = { ...(q.monthly_rent_bdt || {}), $gte: Number(prefs.minRent) };

    const candidates = await Listing.find(q).limit(500).lean();

    const scored = candidates.map(listing => {
      const score = computeMatchScore(listing, prefs);
      return { listing, score };
    }).sort((a, b) => b.score - a.score);

    const top = scored.slice(0, limit).map(s => ({ ...s.listing, matchScore: s.score }));
    res.json({ results: top });
  } catch (err) {
    console.error('Recommendation error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET listings for owner (dashboard)
router.get('/my-listings', authMiddleware, async (req, res) => {
  try {
    const listings = await Listing.find({ owner_id: req.userId })
      .sort({ createdAt: -1 });
      
    // Add virtual field for availability
    const listingsWithAvailability = listings.map(listing => {
      const listingObj = listing.toObject();
      listingObj.isAvailableToTenant = listing.is_available_to_tenant;
      return listingObj;
    });
    
    res.json({ listings: listingsWithAvailability });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// GET a single listing by ID
router.get('/:id', async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('owner_id', 'name email phone');
      
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    // Check if listing should be visible to tenant
    const isAuthenticated = req.headers.authorization || req.headers.Authorization;
    let isOwner = false;
    
    if (isAuthenticated) {
      try {
        const token = isAuthenticated?.startsWith('Bearer ') ? isAuthenticated.slice(7).trim() : isAuthenticated;
        const decoded = jwt.verify(token, JWT_SECRET);
        isOwner = decoded.id === listing.owner_id._id.toString();
      } catch (e) {}
    }
    
    if (!isOwner && !listing.isVisibleToTenant()) {
      return res.status(403).json({ msg: 'This listing is not available' });
    }
    
    res.json(listing);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// CREATE a new listing (owner only)
router.post('/', authMiddleware, async (req, res) => {
  try {
    const {
      title, description, city, area, monthly_rent_bdt, advance_bdt,
      property_type, rooms, available_from, coords, images, utilities,
      status, hold_expiry_date, reservation_expiry_date
    } = req.body;
    
    // Validate required fields
    if (!title || !monthly_rent_bdt || !city || !area) {
      return res.status(400).json({ msg: 'Title, rent, city, and area are required' });
    }
    
    // Validate status if provided
    if (status && !['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }
    
    const newListing = new Listing({
      title,
      description,
      city,
      area,
      monthly_rent_bdt,
      advance_bdt,
      property_type,
      rooms,
      available_from: available_from || new Date(),
      coords,
      images: images || [],
      owner_id: req.userId,
      utilities: utilities || {},
      status: status || 'available_now',
      hold_expiry_date: status === 'on_hold' ? hold_expiry_date : undefined,
      reservation_expiry_date: status === 'reserved' ? reservation_expiry_date : undefined,
      status_history: [{
        status: status || 'available_now',
        changed_at: new Date(),
        changed_by: req.userId,
        notes: 'Listing created'
      }]
    });
    
    await newListing.save();
    res.status(201).json({ msg: 'Listing created successfully', listing: newListing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// UPDATE a listing (owner only)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to update this listing' });
    }
    
    const {
      title, description, city, area, monthly_rent_bdt, advance_bdt,
      property_type, rooms, available_from, coords, images, utilities,
      status, hold_expiry_date, reservation_expiry_date
    } = req.body;
    
    // Update basic fields
    if (title) listing.title = title;
    if (description !== undefined) listing.description = description;
    if (city) listing.city = city;
    if (area) listing.area = area;
    if (monthly_rent_bdt) listing.monthly_rent_bdt = monthly_rent_bdt;
    if (advance_bdt !== undefined) listing.advance_bdt = advance_bdt;
    if (property_type) listing.property_type = property_type;
    if (rooms) listing.rooms = rooms;
    if (available_from) listing.available_from = available_from;
    if (coords) listing.coords = coords;
    if (images) listing.images = images;
    if (utilities) listing.utilities = { ...listing.utilities, ...utilities };
    
    // Handle status update with history
    if (status && status !== listing.status) {
      // Validate status
      if (!['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'].includes(status)) {
        return res.status(400).json({ msg: 'Invalid status' });
      }
      
      // Special handling for different statuses
      if (status === 'on_hold') {
        if (!hold_expiry_date) {
          // Default hold expiry: 7 days from now
          listing.hold_expiry_date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
        } else {
          listing.hold_expiry_date = new Date(hold_expiry_date);
        }
        listing.reservation_expiry_date = undefined;
        listing.rented_to_user_id = undefined;
        listing.rented_at = undefined;
      } else if (status === 'reserved') {
        if (!reservation_expiry_date) {
          // Default reservation expiry: 3 days from now
          listing.reservation_expiry_date = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        } else {
          listing.reservation_expiry_date = new Date(reservation_expiry_date);
        }
        listing.hold_expiry_date = undefined;
        listing.rented_to_user_id = undefined;
        listing.rented_at = undefined;
      } else if (status === 'rented') {
        listing.rented_at = new Date();
        listing.hold_expiry_date = undefined;
        listing.reservation_expiry_date = undefined;
      } else if (status === 'available_now') {
        listing.available_from = new Date();
        listing.hold_expiry_date = undefined;
        listing.reservation_expiry_date = undefined;
        listing.rented_to_user_id = undefined;
        listing.rented_at = undefined;
      } else if (status === 'available_from_date') {
        if (!available_from) {
          return res.status(400).json({ msg: 'Available from date is required for this status' });
        }
        listing.available_from = new Date(available_from);
        listing.hold_expiry_date = undefined;
        listing.reservation_expiry_date = undefined;
        listing.rented_to_user_id = undefined;
        listing.rented_at = undefined;
      }
      
      // Update status and add to history
      await listing.updateStatus(status, req.userId, req.body.status_notes || '');
    }
    
    listing.status_updated_at = new Date();
    await listing.save();
    
    res.json({ msg: 'Listing updated successfully', listing });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// UPDATE listing status only (owner)
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { status, notes, hold_expiry_date, reservation_expiry_date, rented_to_user_id } = req.body;
    
    if (!status) {
      return res.status(400).json({ msg: 'Status is required' });
    }
    
    if (!['available_now', 'available_from_date', 'on_hold', 'reserved', 'rented'].includes(status)) {
      return res.status(400).json({ msg: 'Invalid status' });
    }
    
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to update this listing' });
    }
    
    // Handle special cases
    if (status === 'rented' && !rented_to_user_id) {
      return res.status(400).json({ msg: 'User ID is required when marking as rented' });
    }
    
    // Set expiry dates based on status
    if (status === 'on_hold') {
      listing.hold_expiry_date = hold_expiry_date ? new Date(hold_expiry_date) : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      listing.reservation_expiry_date = undefined;
      listing.rented_to_user_id = undefined;
      listing.rented_at = undefined;
    } else if (status === 'reserved') {
      listing.reservation_expiry_date = reservation_expiry_date ? new Date(reservation_expiry_date) : new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
      listing.hold_expiry_date = undefined;
      listing.rented_to_user_id = undefined;
      listing.rented_at = undefined;
    } else if (status === 'rented') {
      listing.rented_to_user_id = rented_to_user_id;
      listing.rented_at = new Date();
      listing.hold_expiry_date = undefined;
      listing.reservation_expiry_date = undefined;
    } else {
      listing.hold_expiry_date = undefined;
      listing.reservation_expiry_date = undefined;
      listing.rented_to_user_id = undefined;
      listing.rented_at = undefined;
      if (status === 'available_now') {
        listing.available_from = new Date();
      }
    }
    
    // Update status with history
    await listing.updateStatus(status, req.userId, notes || '');
    await listing.save();
    
    res.json({ 
      msg: 'Status updated successfully', 
      listing: {
        ...listing.toObject(),
        isAvailableToTenant: listing.is_available_to_tenant
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// DELETE a listing (owner only)
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ msg: 'Listing not found' });
    }
    
    if (listing.owner_id.toString() !== req.userId) {
      return res.status(403).json({ msg: 'Not authorized to delete this listing' });
    }
    
    await listing.remove();
    res.json({ msg: 'Listing deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// SEED endpoint (keep existing)
router.get('/seed', async (req, res) => {
  try {
    const count = await Listing.countDocuments();
    if (count > 0) return res.json({ seeded: false, msg: 'Listings already exist' });

    const sample = [
      {
        title: '1BR Furnished Flat in Mirpur',
        description: 'Cozy 1 bedroom flat near Mirpur-10 market',
        city: 'Dhaka',
        area: 'Mirpur',
        monthly_rent_bdt: 12000,
        advance_bdt: 36000,
        property_type: 'flat',
        rooms: 1,
        available_from: new Date(),
        coords: { type: 'Point', coordinates: [90.3563, 23.8225] },
        images: [],
        owner_id: null, // You'll need to set this to a valid user ID
        utilities: { wifi: true, lift: false, parking: false, gas: true, water: true, electricity: 'meter' },
        status: 'available_now'
      },
      // ... add more samples with different statuses
    ];

    await Listing.insertMany(sample);
    res.json({ seeded: true, inserted: sample.length });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Seed error' });
  }
});

module.exports = router;