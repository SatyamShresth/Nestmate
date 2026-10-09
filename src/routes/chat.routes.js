// src/routes/chat.routes.js
import { Router } from 'express';
import { getChats, getMessages, startChat, sendMessage } from '../controllers/chat.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();

// All chat routes require authentication
router.use(protect);

// ─── Conversation list ────────────────────────────────

// GET  /api/chats
// Returns all conversations for the logged-in user (no message bodies, metadata only)
router.get('/', getChats);

// POST /api/chats
// Body: { recipientId, listingId? }
// Finds existing chat or creates a new one between two users
router.post('/', startChat);

// ─── Messages within a conversation ──────────────────

// GET  /api/chats/:chatId/messages
// Query: ?page=1&limit=50
// Returns paginated message history; marks messages as read
router.get('/:chatId/messages', getMessages);

// POST /api/chats/:chatId/messages
// Body: { text }
// REST fallback for sending a message (Socket.io is the primary path)
router.post('/:chatId/messages', sendMessage);

export default router;
