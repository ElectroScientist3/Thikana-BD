const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roleAuth');

const router = express.Router();
router.use(authMiddleware, requireAdmin());

router.get('/users', async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    res.json({ users });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;
    if (!['tenant', 'owner', 'admin'].includes(role)) {
      return res.status(400).json({ msg: 'Invalid role' });
    }

    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/verifications', async (req, res) => {
  try {
    const users = await User.find({ role: 'owner' }).select('-password').sort({ updatedAt: -1 });
    res.json({ verifications: users });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.patch('/verifications/:id', async (req, res) => {
  try {
    const { verificationStatus, verificationNotes } = req.body;
    if (!['pending', 'approved', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({ msg: 'Invalid verification status' });
    }

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: 'owner' },
      { verificationStatus, verificationNotes },
      { new: true }
    ).select('-password');
    if (!user) return res.status(404).json({ msg: 'Owner not found' });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

router.get('/fraud-reports', (req, res) => res.json({ reports: [] }));
router.get('/duplicates', (req, res) => res.json({ duplicates: [] }));

module.exports = router;
