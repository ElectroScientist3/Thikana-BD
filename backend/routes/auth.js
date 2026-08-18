const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

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

// Signup
router.post('/signup', async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      phone,
      homeAddress,
      currentLocation,
      familyStatus,
      role,
      verificationStatus,
      verificationDocuments,
      verificationNotes,
      businessName,
      preferredContactMethod,
    } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ msg: 'Name, email, password, and role are required' });
    }
    if (!['tenant', 'owner'].includes(role)) {
      return res.status(400).json({ msg: 'Signup role must be tenant or owner' });
    }
    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ msg: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = new User({
      name,
      email,
      password: hashedPassword,
      phone,
      homeAddress,
      currentLocation,
      familyStatus,
      role,
      verificationStatus,
      verificationDocuments,
      verificationNotes,
      businessName,
      preferredContactMethod,
    });
    await user.save();

    res.status(201).json({ msg: 'User created successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign(
      { id: user._id, role: user.role },
      JWT_SECRET,
      { expiresIn: '1h' }
    );

    res.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const updates = {};
    const fields = ['name', 'email', 'phone', 'homeAddress', 'currentLocation', 'familyStatus'];
    fields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field];
    });

    if (updates.email) {
      const existing = await User.findOne({ email: updates.email, _id: { $ne: req.userId } });
      if (existing) return res.status(400).json({ msg: 'Email already in use' });
    }

    const user = await User.findByIdAndUpdate(req.userId, updates, { new: true }).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user, msg: 'Profile updated successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
