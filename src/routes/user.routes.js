// src/routes/user.routes.js
import { Router } from 'express';
import {
  getUsers, getUserById, updateProfile, updateAvatar,
  saveProfile, getSavedProfiles, blockUser, deleteAccount,
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.js';
import { uploadAvatar } from '../config/cloudinary.js';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = Router();

// ── optionalAuth: attaches req.user if token present, never blocks ──
// Used for public browse so logged-in users get excluded from results.
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return next();
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id).select('-password');
  } catch { /* invalid token — treat as guest */ }
  next();
}

// ─── Public browse (works for guests + logged-in users) ───
router.get('/',    optionalAuth, getUsers);
router.get('/:id', optionalAuth, getUserById);

// ─── Protected routes ──────────────────────────────────
router.patch('/me',             protect, updateProfile);
router.post('/me/avatar',       protect, uploadAvatar.single('avatar'), updateAvatar);
router.get('/me/saved',         protect, getSavedProfiles);
router.delete('/me',            protect, deleteAccount);
router.post('/:id/save',        protect, saveProfile);
router.post('/:id/block',       protect, blockUser);

export default router;