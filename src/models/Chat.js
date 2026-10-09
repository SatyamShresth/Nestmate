// src/models/Chat.js
import mongoose from 'mongoose';

// ─── Individual message ───────────────────────────────
const messageSchema = new mongoose.Schema({
  sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  text:      { type: String, maxlength: 2000 },
  type:      { type: String, enum: ['text', 'image', 'system'], default: 'text' },
  imageUrl:  String,
  read:      { type: Boolean, default: false },
  readAt:    Date,
}, { timestamps: true });

// ─── Conversation thread between two users ────────────
const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  }],
  messages:    [messageSchema],
  lastMessage: {
    sender:    { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    text:      String,
    createdAt: Date,
  },
  // Plain Object (not Map) so it serializes correctly to JSON
  // Keys are userId strings, values are unread counts
  unreadCounts: {
    type:    mongoose.Schema.Types.Mixed,
    default: {},
  },
  listing: { type: mongoose.Schema.Types.ObjectId, ref: 'Listing' },
}, { timestamps: true });

chatSchema.index({ participants: 1 });
chatSchema.index({ updatedAt: -1 });

export default mongoose.model('Chat', chatSchema);