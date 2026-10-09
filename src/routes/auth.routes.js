// src/routes/auth.routes.js
import { Router } from 'express';
import { register, login, firebaseAuth, getMe, forgotPassword, resetPassword, changePassword ,verifyEmail} from '../controllers/auth.controller.js';
import { protect } from '../middleware/auth.js';
import rateLimit from 'express-rate-limit';

const router = Router();

// ─── Stricter rate limit for auth endpoints ───────────
// 10 attempts per 15 min per IP (brute-force protection)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { success: false, error: 'Too many auth attempts, try again later.' },
  skipSuccessfulRequests: true, // only count failed attempts
});

// ─── Public routes ────────────────────────────────────

// POST /api/auth/register
// Body: { name, email, password, phone? }
router.post('/register', authLimiter, register);

// POST /api/auth/login
// Body: { email, password }
router.post('/login', authLimiter, login);

// POST /api/auth/firebase
// Body: { idToken }  ← Firebase ID token from Google Sign-In or Phone OTP
// Works for both providers; backend auto-detects via sign_in_provider claim
router.post('/firebase', authLimiter, firebaseAuth);

// POST /api/auth/forgot-password  Body: { email }
// POST /api/auth/reset-password   Body: { token, email, password }
const resetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { success: false, error: 'Too many reset attempts. Try again in an hour.' },
});
router.post('/forgot-password', resetLimiter, forgotPassword);
router.post('/reset-password',  resetLimiter, resetPassword);

// ─── Protected routes ─────────────────────────────────

// GET /api/auth/me
// Returns the currently logged-in user's profile
router.get('/verify-email', verifyEmail);
router.get('/me', protect, getMe);
router.patch('/change-password', protect, changePassword);
export default router;