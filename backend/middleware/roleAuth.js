const User = require('../models/User');

const requireRole = (...allowedRoles) => async (req, res, next) => {
  if (!req.userId) {
    return res.status(401).json({ msg: 'Authentication required' });
  }

  try {
    const user = await User.findById(req.userId).select('role');
    if (!user) {
      return res.status(401).json({ msg: 'User not found' });
    }

    if (!allowedRoles.includes(user.role)) {
      return res.status(403).json({ msg: 'Insufficient permissions' });
    }

    req.userRole = user.role;
    next();
  } catch (err) {
    next(err);
  }
};

const requireTenant = () => requireRole('tenant');
const requireOwner = () => requireRole('owner');
const requireAdmin = () => requireRole('admin');

module.exports = {
  requireRole,
  requireTenant,
  requireOwner,
  requireAdmin,
};
