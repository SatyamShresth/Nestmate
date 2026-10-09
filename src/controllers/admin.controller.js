// src/controllers/admin.controller.js
import User from '../models/User.js';
import Listing from '../models/Listing.js';
import { Notification, Report } from '../models/Notification.js';
import Chat from '../models/Chat.js';
import { cloudinary } from '../config/cloudinary.js';

// ─── GET /api/admin/stats ─────────────────────────────
export async function getDashboardStats(req, res, next) {
  try {
    const now = new Date();
    const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers, newUsersThisWeek,
      totalListings, newListingsThisWeek,
      activeListings,
      openReports,
      totalChats,
      bannedUsers,
      cityBreakdown,
    ] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ createdAt: { $gte: weekAgo } }),
      Listing.countDocuments(),
      Listing.countDocuments({ createdAt: { $gte: weekAgo } }),
      Listing.countDocuments({ status: 'active' }),
      Report.countDocuments({ status: 'open' }),
      Chat.countDocuments(),
      User.countDocuments({ status: 'banned' }),
      User.aggregate([
        { $match: { city: { $exists: true, $ne: '' } } },
        { $group: { _id: '$city', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 6 },
      ]),
    ]);

    res.json({
      success: true,
      data: {
        users:    { total: totalUsers, newThisWeek: newUsersThisWeek, banned: bannedUsers },
        listings: { total: totalListings, active: activeListings, newThisWeek: newListingsThisWeek },
        reports:  { open: openReports },
        chats:    { total: totalChats },
        cityBreakdown: cityBreakdown.map(c => ({ city: c._id, count: c.count })),
      },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/admin/users ─────────────────────────────
export async function adminGetUsers(req, res, next) {
  try {
    const { page = 1, limit = 20, status, search } = req.query;
    const filter = {};
    if (status) filter.status = status;
    if (search) filter.$text = { $search: search };

    const skip = (Number(page) - 1) * Number(limit);
    const [users, total] = await Promise.all([
      User.find(filter)
        .select('-password -firebaseUid')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      User.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: users,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /api/admin/users/:id ───────────────────────
export async function adminUpdateUser(req, res, next) {
  try {
    const { status, isVerified, isAdmin } = req.body;
    const updates = {};
    if (status     !== undefined) updates.status     = status;
    if (isVerified !== undefined) updates.isVerified = isVerified;
    if (isAdmin    !== undefined) updates.isAdmin    = isAdmin;

    const user = await User.findByIdAndUpdate(
      req.params.id, { $set: updates }, { new: true }
    ).select('-password -firebaseUid');

    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    // Notify user if banned/unbanned
    if (updates.status) {
      await Notification.create({
        recipient: user._id,
        type:      'system',
        text:      updates.status === 'banned'
          ? 'Your account has been suspended. Contact support.'
          : 'Your account has been reactivated.',
      });
    }

    res.json({ success: true, data: user });
  } catch (err) { next(err); }
}

// ─── DELETE /api/admin/users/:id ─────────────────────
export async function adminDeleteUser(req, res, next) {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found' });

    if (user.avatarPublicId) await cloudinary.uploader.destroy(user.avatarPublicId);

    // Delete all their listings + images
    const listings = await Listing.find({ owner: user._id });
    for (const listing of listings) {
      for (const img of listing.images) {
        if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
      }
      await listing.deleteOne();
    }

    await user.deleteOne();
    res.json({ success: true, message: 'User and all associated data deleted' });
  } catch (err) { next(err); }
}

// ─── GET /api/admin/listings ──────────────────────────
export async function adminGetListings(req, res, next) {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const filter = {};
    if (status) filter.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate('owner', 'name email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Listing.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: listings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /api/admin/listings/:id ───────────────────
// Approve, reject, or ban a listing
export async function adminUpdateListing(req, res, next) {
  try {
    const { status } = req.body;
    const listing = await Listing.findByIdAndUpdate(
      req.params.id,
      { $set: { status } },
      { new: true }
    ).populate('owner', '_id name');

    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    // Notify listing owner
    const msgMap = {
      active:  `Your listing "${listing.title}" has been approved and is now live.`,
      banned:  `Your listing "${listing.title}" has been removed for violating our guidelines.`,
      pending: `Your listing "${listing.title}" is under review.`,
    };
    if (msgMap[status]) {
      await Notification.create({
        recipient: listing.owner._id,
        type:      'listing',
        text:      msgMap[status],
        link:      `/listings/${listing._id}`,
      });
    }

    res.json({ success: true, data: listing });
  } catch (err) { next(err); }
}

// ─── DELETE /api/admin/listings/:id ──────────────────
export async function adminDeleteListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    for (const img of listing.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
    }
    await listing.deleteOne();
    res.json({ success: true, message: 'Listing deleted' });
  } catch (err) { next(err); }
}

// ─── GET /api/admin/reports ───────────────────────────
export async function adminGetReports(req, res, next) {
  try {
    const { page = 1, limit = 20, status = 'open' } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const [reports, total] = await Promise.all([
      Report.find({ status })
        .populate('reporter',       'name email avatar')
        .populate('targetUser',     'name email avatar')
        .populate('targetListing',  'title city')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Report.countDocuments({ status }),
    ]);

    res.json({
      success: true,
      data: reports,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /api/admin/reports/:id ────────────────────
export async function adminResolveReport(req, res, next) {
  try {
    const { status } = req.body; // 'resolved' | 'dismissed'
    if (!['resolved', 'dismissed'].includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    const report = await Report.findByIdAndUpdate(
      req.params.id,
      { $set: { status, resolvedBy: req.user._id } },
      { new: true }
    );

    if (!report) return res.status(404).json({ success: false, error: 'Report not found' });
    res.json({ success: true, data: report });
  } catch (err) { next(err); }
}
