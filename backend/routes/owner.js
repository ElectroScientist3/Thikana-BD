const express = require('express');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { requireOwner } = require('../middleware/roleAuth');

const router = express.Router();

router.patch('/verification', authMiddleware, requireOwner(), async (req, res) => {
  try {
    const { verificationDocuments, verificationNotes } = req.body;
    const user = await User.findByIdAndUpdate(
      req.userId,
      {
        verificationDocuments: Array.isArray(verificationDocuments) ? verificationDocuments : [],
        verificationNotes: verificationNotes || '',
        verificationStatus: 'pending',
      },
      { new: true }
    ).select('-password');

    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json({ user, msg: 'Verification submitted successfully' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
