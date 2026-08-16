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
const viewingsRoutes = require('./routes/viewings'); // NEW
const cors = require('cors');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
mongoose.connect(mongoUri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
  .then(() => console.log('✅ MongoDB connected!'))
  .catch(err => console.error('❌ MongoDB connection error:', err));

// allow requests from your React frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/listings', listingsRoutes);
app.use('/api/listings/owner', listingsOwnerRoutes);
app.use('/api/commute', commuteRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/viewings', viewingsRoutes); // NEW - Viewing appointments

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

const DEFAULT_PORT = Number(process.env.PORT) || 5000;

function startServer(port, retries = 10) {
  const server = app.listen(port, () => {
    console.log(`🚀 Server running on port ${port}`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      if (retries > 0) {
        console.warn(`Port ${port} in use, trying port ${port + 1}...`);
        startServer(port + 1, retries - 1);
      } else {
        console.error(`All retries failed. Port ${port} still in use. Exiting.`);
        process.exit(1);
      }
    } else {
      console.error('Server error:', err);
      process.exit(1);
    }
  });
}

startServer(DEFAULT_PORT);