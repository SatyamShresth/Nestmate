// src/controllers/notification.controller.js
import { Notification, Report } from '../models/Notification.js';

// ─── GET /api/notifications ───────────────────────────
export async function getNotifications(req, res, next) {
  try {
    const { page = 1, limit = 30, unreadOnly } = req.query;

    // Support both old 'read' field and new 'isRead' field
    const filter = { recipient: req.user._id };
    if (unreadOnly === 'true') {
      filter.$or = [{ isRead: false }, { isRead: { $exists: false }, read: false }, { isRead: { $exists: false }, read: { $exists: false } }];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [notifications, total] = await Promise.all([
      Notification.find({ recipient: req.user._id })
        .populate('actor', 'name avatar')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),   // plain JS objects — avoids Mongoose field issues
      Notification.countDocuments({ recipient: req.user._id }),
    ]);

    // Normalise: map old 'read' field to 'isRead' for frontend
    const normalised = notifications.map(n => ({
      ...n,
      isRead: n.isRead !== undefined ? n.isRead : (n.read || false),
    }));

    // Count unread — check both fields
    const unreadCount = normalised.filter(n => !n.isRead).length;

    res.json({
      success: true,
      data:    normalised,
      unreadCount,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── PATCH /api/notifications/read-all ───────────────
export async function markAllRead(req, res, next) {
  try {
    // Update both old and new field names
    await Notification.updateMany(
      { recipient: req.user._id },
      { $set: { isRead: true, read: true } }
    );
    res.json({ success: true, unreadCount: 0 });
  } catch (err) { next(err); }
}

// ─── PATCH /api/notifications/:id/read ───────────────
export async function markRead(req, res, next) {
  try {
    await Notification.findOneAndUpdate(
      { _id: req.params.id, recipient: req.user._id },
      { $set: { isRead: true, read: true } }
    );
    // Recount unread
    const unreadCount = await Notification.countDocuments({
      recipient: req.user._id,
      $or: [{ isRead: false }, { isRead: { $exists: false }, read: false }],
    });
    res.json({ success: true, unreadCount });
  } catch (err) { next(err); }
}

// ─── DELETE /api/notifications/:id ───────────────────
export async function deleteNotification(req, res, next) {
  try {
    await Notification.findOneAndDelete({ _id: req.params.id, recipient: req.user._id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── DELETE /api/notifications ────────────────────────
export async function clearNotifications(req, res, next) {
  try {
    await Notification.deleteMany({ recipient: req.user._id });
    res.json({ success: true });
  } catch (err) { next(err); }
}

// ─── POST /api/notifications/report ──────────────────
export async function submitReport(req, res, next) {
  try {
    const { targetUser, targetListing, reason, details } = req.body;
    if (!reason) return res.status(400).json({ success: false, error: 'Reason required' });
    if (!targetUser && !targetListing) {
      return res.status(400).json({ success: false, error: 'Provide a target user or listing' });
    }
    const report = await Report.create({
      reporter: req.user._id, targetUser, targetListing, reason, details,
    });
    res.status(201).json({ success: true, data: report });
  } catch (err) { next(err); }
}