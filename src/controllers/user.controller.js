// src/controllers/user.controller.js
import User from '../models/User.js';
import { Notification } from '../models/Notification.js';
import { cloudinary } from '../config/cloudinary.js';

// ─── GET /api/users ───────────────────────────────────
// Browse / search users with filters + pagination
export async function getUsers(req, res, next) {
  try {
    const {
      city, gender, budgetMin, budgetMax,
      smoking, drinking, pets, sleep, cleanliness, food,
      search, page = 1, limit = 20, sort = 'matchScore',
    } = req.query;

    const filter = { status: 'active' };

    // Exclude logged-in user + their blocked users from results
    if (req.user?._id) {
      const excludeIds = [req.user._id];
      if (req.user.blockedUsers?.length) {
        excludeIds.push(...req.user.blockedUsers);
      }
      filter._id = { $nin: excludeIds };
    }

    if (city)   filter.city   = new RegExp(city, 'i');
    if (gender) filter.gender = gender;
    if (budgetMin) filter.budgetMax = { $gte: Number(budgetMin) };
    if (budgetMax) filter.budgetMin = { $lte: Number(budgetMax) };

    // Lifestyle filters
    const lifestyleFilters = { smoking, drinking, pets, sleep, cleanliness, food };
    for (const [key, val] of Object.entries(lifestyleFilters)) {
      if (val) filter[`lifestyle.${key}`] = val;
    }

    // Full-text search
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const sortMap = {
      matchScore: { matchScore: -1 },
      newest:     { createdAt: -1 },
      budget:     { budgetMin: 1 },
    };

    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -firebaseUid -blockedUsers -savedProfiles -savedListings -phone')
        .sort(sortMap[sort] || sortMap.matchScore)
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: {
        total,
        page: Number(page),
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/users/:id ───────────────────────────────
export async function getUserById(req, res, next) {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -firebaseUid -blockedUsers');

    if (!user || user.status === 'banned') {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

// ─── PATCH /api/users/me ──────────────────────────────
export async function updateProfile(req, res, next) {
  try {
    const allowed = [
      'name', 'age', 'gender', 'occupation', 'bio',
      'city', 'areas', 'budgetMin', 'budgetMax', 'lifestyle',
      'phone',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password -firebaseUid');

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

// ─── POST /api/users/me/avatar ────────────────────────
// Handled by Cloudinary middleware - file is already uploaded
export async function updateAvatar(req, res, next) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    // Delete old avatar from Cloudinary
    if (req.user.avatarPublicId) {
      await cloudinary.uploader.destroy(req.user.avatarPublicId);
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { avatar: req.file.path, avatarPublicId: req.file.filename },
      { new: true }
    ).select('-password -firebaseUid');

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

// ─── POST /api/users/:id/save ─────────────────────────
export async function saveProfile(req, res, next) {
  try {
    const targetId = req.params.id;
    const already = req.user.savedProfiles.includes(targetId);

    const op = already ? '$pull' : '$push';
    await User.findByIdAndUpdate(req.user._id, { [op]: { savedProfiles: targetId } });

    // Notify target when saved (not unsaved)
    if (!already) {
      await Notification.create({
        recipient: targetId,
        type:      'save',
        text:      `${req.user.name} saved your profile`,
        actor:     req.user._id,
        link:      `/users/${req.user._id}`,
      });
    }

    res.json({ success: true, saved: !already });
  } catch (err) { next(err); }
}

// ─── GET /api/users/me/saved ──────────────────────────
export async function getSavedProfiles(req, res, next) {
  try {
    const user = await User.findById(req.user._id)
      .populate('savedProfiles', '-password -firebaseUid -blockedUsers');
    res.json({ success: true, data: user.savedProfiles });
  } catch (err) { next(err); }
}

// ─── POST /api/users/:id/block ────────────────────────
export async function blockUser(req, res, next) {
  try {
    const targetId = req.params.id;
    if (targetId === req.user._id.toString()) {
      return res.status(400).json({ success: false, error: 'Cannot block yourself' });
    }

    const already = req.user.blockedUsers.includes(targetId);
    const op = already ? '$pull' : '$push';

    await User.findByIdAndUpdate(req.user._id, {
      [op]: { blockedUsers: targetId },
      // Also remove from saved if blocking
      ...(!already && { $pull: { savedProfiles: targetId } }),
    });

    res.json({ success: true, blocked: !already });
  } catch (err) { next(err); }
}

// ─── DELETE /api/users/me ─────────────────────────────
export async function deleteAccount(req, res, next) {
  try {
    const user = await User.findById(req.user._id);

    // Remove avatar from Cloudinary
    if (user.avatarPublicId) {
      await cloudinary.uploader.destroy(user.avatarPublicId);
    }

    await User.findByIdAndDelete(req.user._id);
    res.json({ success: true, message: 'Account deleted' });
  } catch (err) { next(err); }
}