// src/middleware/auth.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

/**
 * protect — verifies JWT, attaches req.user
 */
export async function protect(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, error: 'Not authenticated. Please login.' });
  }
  try {
    const token   = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user    = await User.findById(decoded.id).select('-password');
    if (!user) {
      return res.status(401).json({ success: false, error: 'User no longer exists.' });
    }
    if (user.status === 'banned') {
      return res.status(403).json({ success: false, error: 'Your account has been suspended.' });
    }
    req.user = user;
    next();
  } catch (err) {
    const msg = err.name === 'TokenExpiredError'
      ? 'Session expired. Please login again.'
      : 'Invalid token. Please login again.';
    return res.status(401).json({ success: false, error: msg });
  }
}

/**
 * adminOnly — must come AFTER protect.
 * Double-checks both the flag on req.user AND re-reads from DB
 * so a user whose isAdmin was revoked is immediately blocked
 * even if they still hold a valid JWT.
 */
export async function adminOnly(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ success: false, error: 'Not authenticated.' });
  }
  // Re-read from DB to catch real-time role changes
  const freshUser = await User.findById(req.user._id).select('isAdmin status');
  if (!freshUser || !freshUser.isAdmin) {
    return res.status(403).json({
      success: false,
      error:   'Admin access required. You do not have permission to perform this action.',
    });
  }
  if (freshUser.status === 'banned') {
    return res.status(403).json({ success: false, error: 'Your account has been suspended.' });
  }
  next();
}

/**
 * signToken — generates a signed JWT
 */
export function signToken(id) {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}
