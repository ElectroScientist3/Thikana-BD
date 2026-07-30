require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const authRoutes = require('./routes/auth');
const cors = require('cors');

const app = express();
app.use(express.json());

// MongoDB Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected!'))
  .catch(err => console.error('MongoDB connection error:', err));

// allow requests from your React frontend
app.use(cors({
  origin: 'http://localhost:5173',
  credentials: true,
}));

// Routes
app.use('/api/auth', authRoutes);

// Dashboard test route (protected)
const jwt = require('jsonwebtoken');
app.get('/api/dashboard', (req, res) => {
  const token = req.headers['authorization']?.split(' ')[1]; // "Bearer token"
  if (!token) return res.status(401).json({ msg: 'No token provided' });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ msg: `Welcome to your dashboard, user ${decoded.id}` });
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));