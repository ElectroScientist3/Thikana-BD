const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const listingsRoutes = require('./routes/listings');
const commuteRoutes = require('./routes/commute');
const paymentsRoutes = require('./routes/payments');
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// allow requests from your React frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/commute', commuteRoutes);
app.use('/api/payments', paymentsRoutes);

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

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));