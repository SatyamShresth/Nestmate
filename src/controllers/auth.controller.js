// src/controllers/auth.controller.js
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { verifyFirebaseToken } from '../config/firebase.js';


// ─── Helper: send token response ─────────────────────
function tokenResponse(user, res, statusCode = 200) {
  const token = signToken(user._id);
  res.status(statusCode).json({
    success: true,
    token,
    user: user.toPublic(),
  });
}

// ─── POST /api/auth/register ─────────────────────────
export async function register(req, res, next) {
  try {
    const { name, email, password, phone } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Name, email and password are required'
      });
    }

    const existing = await User.findOne({ email });

    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered'
      });
    }

    const user = await User.create({
      name,
      email,
      password,
      phone,
      authProvider: 'local'
    });

    const plainToken =
      crypto.randomBytes(32).toString('hex');

    const hashedToken =
      crypto
        .createHash('sha256')
        .update(plainToken)
        .digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires =
      new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();
    console.log('BEFORE EMAIL');

    await sendVerificationEmail(
      user.email,
      user.name,
      plainToken
    );
    console.log('AFTER EMAIL');

    res.status(201).json({
      success: true,
      message:
        'Account created successfully. Please verify your email before logging in.'
    });

  } catch (err) {
    next(err);
  }
}

// ─── POST /api/auth/login ────────────────────────────
export async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.password) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }
    const valid = await user.comparePassword(password);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Invalid credentials' });
    }

    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        error: 'Please verify your email before logging in.'
      });
    }
    user.lastSeen = new Date();
    await user.save();
    tokenResponse(user, res);
  } catch (err) { next(err); }
}

// ─── POST /api/auth/firebase ─────────────────────────
// Works for both Google Sign-In and Phone OTP.
// Client sends the Firebase ID token; we verify it and
// find-or-create the user, then return our own JWT.
export async function firebaseAuth(req, res, next) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ success: false, error: 'Firebase ID token required' });
    }

    const decoded = await verifyFirebaseToken(idToken);
    const { uid, email, name, phone_number, picture, sign_in_provider } = decoded;
    const provider = sign_in_provider?.includes('google') ? 'google' : 'phone';

    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      // First time – create account
      user = await User.create({
        name:         name || phone_number || 'NestMate User',
        email:        email || `${uid}@nestmate.app`,
        phone:        phone_number,
        avatar:       picture,
        firebaseUid:  uid,
        authProvider: provider,
        isVerified:   true, // Firebase already verified
      });
    }

    user.lastSeen = new Date();
    await user.save();
    tokenResponse(user, res);
  } catch (err) { next(err); }
}

// ─── GET /api/auth/me ────────────────────────────────
export async function getMe(req, res) {
  res.json({ success: true, user: req.user.toPublic() });
}

import crypto from 'crypto';
import { sendPasswordResetEmail, sendVerificationEmail } from '../services/email.service.js';

// ─── POST /api/auth/forgot-password ──────────────────
export async function forgotPassword(req, res, next) {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() })
      .select('+resetPasswordToken +resetPasswordExpires');

    // Always return success — never reveal whether email exists
    const genericOk = { success: true, message: 'If that email exists, a reset link has been sent.' };

    if (!user) return res.json(genericOk);

    // ── Google / Firebase users cannot reset password ──
    if (user.authProvider && user.authProvider !== 'local') {
      const providerMap = { google: 'Google Sign-In', phone: 'Phone OTP' };
      const provider    = providerMap[user.authProvider] || user.authProvider;
      return res.status(400).json({
        success:  false,
        error:    `This account uses ${provider}. Please continue with ${provider}.`,
        provider: user.authProvider,
      });
    }

    // ── Generate secure token ──────────────────────────
    const plainToken  = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(plainToken).digest('hex');

    user.resetPasswordToken   = hashedToken;
    user.resetPasswordExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await user.save({ validateBeforeSave: false });

    // ── Send email ─────────────────────────────────────
    try {
      await sendPasswordResetEmail(user.email, user.name, plainToken);
    } catch (emailErr) {
      // Roll back token if email fails so user can try again
      user.resetPasswordToken   = undefined;
      user.resetPasswordExpires = undefined;
      await user.save({ validateBeforeSave: false });
      console.error('Email send failed:', emailErr.message);
      return res.status(500).json({ success: false, error: 'Failed to send reset email. Check your email configuration.' });
    }

    res.json(genericOk);
  } catch (err) { next(err); }
}

// ─── POST /api/auth/reset-password ───────────────────
export async function resetPassword(req, res, next) {
  try {
    const { token, email, password } = req.body;
    if (!token || !email || !password) {
      return res.status(400).json({ success: false, error: 'Token, email and new password are required' });
    }
    if (password.length < 8) {
      return res.status(400).json({ success: false, error: 'Password must be at least 8 characters' });
    }

    // Hash the token to compare with stored hash
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      email:                email.toLowerCase().trim(),
      resetPasswordToken:   hashedToken,
      resetPasswordExpires: { $gt: Date.now() },  // not expired
    }).select('+resetPasswordToken +resetPasswordExpires +password');

    if (!user) {
      return res.status(400).json({ success: false, error: 'Reset link is invalid or has expired. Please request a new one.' });
    }

    // ── Set new password and clear token ─────────────
    user.password             = password;       // pre-save hook hashes it
    user.resetPasswordToken   = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    // Auto-login after reset
    const authToken = signToken(user._id);
    res.json({
      success: true,
      message: 'Password reset successfully.',
      token:   authToken,
      user:    user.toPublic(),
    });
  } catch (err) { next(err); }
}

export async function verifyEmail(req,res,next) {
  try {

    const { token,email } = req.query;

    const hashedToken =
      crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    const user =
      await User.findOne({
        email: email.toLowerCase().trim(),
        emailVerificationToken: hashedToken,
        emailVerificationExpires:{
          $gt: Date.now()
        }
      }).select(
        '+emailVerificationToken +emailVerificationExpires'
      );

    if (!user) {
      return res.status(400).json({
        success:false,
        error:'Verification link invalid or expired'
      });
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    res.json({
      success:true,
      message:'Email verified successfully'
    });

  } catch(err){
    next(err);
  }
}

// ─── PATCH /api/auth/change-password ────────────────
export async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Current password and new password are required'
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 8 characters'
      });
    }

    const user = await User.findById(req.user._id)
      .select('+password');

    const valid = await user.comparePassword(currentPassword);

    if (!valid) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    user.password = newPassword;

    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (err) {
    next(err);
  }
}