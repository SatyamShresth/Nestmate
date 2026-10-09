// src/controllers/chat.controller.js
import Chat from '../models/Chat.js';
import { Notification } from '../models/Notification.js';
import { io } from '../server.js';

// ─── GET /api/chats ───────────────────────────────────
export async function getChats(req, res, next) {
  try {
    const chats = await Chat.find({ participants: req.user._id })
      .select('-messages')
      .populate('participants', 'name avatar lastSeen')
      .populate('listing', 'title city rent')
      .sort({ updatedAt: -1 });

    const data = chats.map(c => {
      try {
        const obj = c.toObject();

        // Safely normalise unreadCounts — handles old Map docs and new Mixed docs
        let uc = obj.unreadCounts;
        if (!uc || typeof uc !== 'object') {
          uc = {};
        } else if (uc instanceof Map) {
          // Convert Map → plain object for old documents
          const plain = {};
          uc.forEach((v, k) => { plain[k] = v; });
          uc = plain;
        }
        obj.unreadCounts = uc;

        // Safely normalise lastMessage
        if (!obj.lastMessage || typeof obj.lastMessage !== 'object') {
          obj.lastMessage = null;
        }

        return obj;
      } catch (e) {
        // If a single chat fails to convert, return a safe minimal object
        return {
          _id:          c._id,
          participants: c.participants,
          lastMessage:  null,
          unreadCounts: {},
          updatedAt:    c.updatedAt,
        };
      }
    });

    res.json({ success: true, data });
  } catch (err) { next(err); }
}

// ─── GET /api/chats/:chatId/messages ─────────────────
export async function getMessages(req, res, next) {
  try {
    const { chatId } = req.params;
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;

    const chat = await Chat.findById(chatId)
      .populate('participants', 'name avatar')
      .select({ messages: { $slice: [-(page * limit), limit] } });

    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });

    const isParticipant = chat.participants.some(p =>
      p._id.equals(req.user._id)
    );
    if (!isParticipant) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Mark as read using $set with dotted key — works for both Map and Mixed
    await Chat.updateOne(
      { _id: chatId },
      { $set: { [`unreadCounts.${req.user._id}`]: 0 } }
    );

    res.json({ success: true, data: chat.messages, participants: chat.participants });
  } catch (err) { next(err); }
}

// ─── POST /api/chats ──────────────────────────────────
export async function startChat(req, res, next) {
  try {
    const { recipientId, listingId } = req.body;
    if (!recipientId) {
      return res.status(400).json({ success: false, error: 'recipientId required' });
    }

    let chat = await Chat.findOne({
      participants: { $all: [req.user._id, recipientId], $size: 2 },
    });

    if (!chat) {
      chat = await Chat.create({
        participants: [req.user._id, recipientId],
        listing:      listingId || undefined,
        unreadCounts: {
          [recipientId]:               0,
          [req.user._id.toString()]:   0,
        },
      });
    }

    await chat.populate('participants', 'name avatar lastSeen');
    res.status(201).json({ success: true, data: chat.toObject() });
  } catch (err) { next(err); }
}

// ─── POST /api/chats/:chatId/messages ────────────────
// REST fallback when Socket.io is not connected
export async function sendMessage(req, res, next) {
  try {
    const { chatId } = req.params;
    const { text }   = req.body;
    if (!text?.trim()) {
      return res.status(400).json({ success: false, error: 'Message text required' });
    }

    const chat = await Chat.findById(chatId);
    if (!chat) return res.status(404).json({ success: false, error: 'Chat not found' });
    if (!chat.participants.some(id => id.equals(req.user._id))) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Push message
    const newMsg = { sender: req.user._id, text };
    chat.messages.push(newMsg);
    chat.lastMessage = { sender: req.user._id, text, createdAt: new Date() };

    // Increment unread for the OTHER participant using plain object access
    const otherId = chat.participants.find(id => !id.equals(req.user._id));
    if (otherId) {
      const key  = otherId.toString();
      const prev = (chat.unreadCounts || {})[key] || 0;
      chat.unreadCounts         = chat.unreadCounts || {};
      chat.unreadCounts[key]    = prev + 1;
      chat.markModified('unreadCounts');   // required for Mixed type
    }

    await chat.save();

    const message = chat.messages[chat.messages.length - 1];
    const msgObj  = message.toObject();

    // Emit to anyone already in the chat room (Socket.io)
    io.to(`chat:${chatId}`).emit('new_message', {
      chatId,
      message: { ...msgObj, senderName: req.user.name },
    });

    // Also notify the recipient's personal room so their chat list refreshes
    if (otherId) {
      io.to(`user:${otherId}`).emit('chat_updated', {
        chatId,
        lastMessage: { text, createdAt: new Date() },
        senderId:    req.user._id,
        senderName:  req.user.name,
      });
      await Notification.create({
        recipient: otherId,
        type:      'message',
        text:      `New message from ${req.user.name}`,
        actor:     req.user._id,
        link:      `chat:${chatId}`,
      });
      io.to(`user:${otherId}`).emit('notification', {
        type: 'message',
        text: `New message from ${req.user.name}`,
      });
    }

    res.status(201).json({ success: true, data: msgObj });
  } catch (err) { next(err); }
}