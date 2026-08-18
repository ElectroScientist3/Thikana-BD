const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'thikana-dev-secret';

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  
  if (!token) {
    return res.status(401).json({ msg: 'No token provided' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.id;
    next();
  } catch (err) {
    res.status(401).json({ msg: 'Invalid token' });
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization || req.headers.Authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader;
  
  if (token) {
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      req.userId = decoded.id;
    } catch (err) {
      // Invalid token, but we don't block the request
    }
  }
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };