// server.js
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const listingsRoutes = require('./routes/listings');
const listingsOwnerRoutes = require('./routes/listings-owner');
const commuteRoutes = require('./routes/commute');
const paymentsRoutes = require('./routes/payments');
const notificationsRoutes = require('./routes/notifications');
const viewingsRoutes = require('./routes/viewings');
const rentalApplicationsRoutes = require('./routes/rental-applications');
const bookingsRoutes = require('./routes/bookings');
const rentLedgerRoutes = require('./routes/rent-ledger');
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!mongoUri) {
  console.error('ERROR: MONGO_URI or MONGODB_URI not found in environment variables');
  process.exit(1);
}

mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => {
    console.error('MongoDB connection error:', err);
    process.exit(1);
  });

// allow requests from your React frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Routes - ORDER MATTERS: More specific routes should come before generic ones
app.use('/api/auth', authRoutes);
app.use('/api/listings/owner', listingsOwnerRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/commute', commuteRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/viewings', viewingsRoutes);
app.use('/api/applications', rentalApplicationsRoutes);
app.use('/api/bookings', bookingsRoutes);
app.use('/api/rent-ledger', rentLedgerRoutes);

// Dashboard test route (protected)
const jwt = require('jsonwebtoken');
app.get('/api/dashboard', (req, res) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  if (!token) return res.status(401).json({ msg: 'No token provided' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    res.json({ msg: `Welcome to your dashboard, user ${decoded.id}` });
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ msg: 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ msg: 'Route not found' });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));