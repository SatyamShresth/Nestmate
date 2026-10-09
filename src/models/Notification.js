// src/models/Notification.js
import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  actor:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  type: {
    type:    String,
    enum:    ['message', 'match', 'listing', 'enquiry', 'save', 'verify', 'report', 'system'],
    default: 'system',
  },
  text:   { type: String, required: true },
  link:   String,
  isRead: { type: Boolean, default: false },
  read:   { type: Boolean, default: false },  // legacy field — kept for old documents
}, { timestamps: true, strict: false });      // strict:false allows old field names

notificationSchema.index({ recipient: 1, createdAt: -1 });

export const Notification = mongoose.model('Notification', notificationSchema);

// ─── Report model ─────────────────────────────────────
const reportSchema = new mongoose.Schema({
  reporter:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  targetUser:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  targetListing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
  reason:        { type: String, required: true },
  details:       String,
  status:        { type: String, enum: ['open', 'resolved', 'dismissed'], default: 'open' },
  resolvedBy:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true });

export const Report = mongoose.model('Report', reportSchema);