// src/socket/index.js
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Chat from '../models/Chat.js';
import { Notification } from '../models/Notification.js';

export function registerSocketHandlers(io) {

  // ─── Auth middleware ──────────────────────────────────
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user    = await User.findById(decoded.id).select('_id name avatar');
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.user._id.toString();

    // Join personal notification room immediately
    socket.join(`user:${userId}`);

    await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
    io.emit('user_online', { userId });

    // ─── Join a chat room ─────────────────────────────
    socket.on('join_chat', async ({ chatId }) => {
      try {
        const chat = await Chat.findById(chatId).select('participants');
        if (!chat?.participants.some(id => id.equals(userId))) {
          return socket.emit('error', { message: 'Not authorized for this chat' });
        }
        socket.join(`chat:${chatId}`);
        // Mark as read — plain object, markModified needed
        const key = `unreadCounts.${userId}`;
        await Chat.updateOne({ _id: chatId }, { $set: { [key]: 0 } });
        socket.to(`chat:${chatId}`).emit('user_joined', { userId, chatId });
      } catch (err) {
        socket.emit('error', { message: 'Could not join chat' });
      }
    });

    // ─── Leave a chat room ────────────────────────────
    socket.on('leave_chat', ({ chatId }) => {
      socket.leave(`chat:${chatId}`);
    });

    // ─── Send message ─────────────────────────────────
    socket.on('send_message', async ({ chatId, text }) => {
      if (!text?.trim()) return;
      try {
        const chat = await Chat.findById(chatId);
        if (!chat || !chat.participants.some(id => id.equals(userId))) return;

        // Push message
        const newMsg = { sender: socket.user._id, text };
        chat.messages.push(newMsg);
        chat.lastMessage = { sender: socket.user._id, text, createdAt: new Date() };

        // Increment unread for recipient using plain object
        const otherId = chat.participants.find(id => !id.equals(userId));
        if (otherId) {
          const key  = otherId.toString();
          const prev = (chat.unreadCounts || {})[key] || 0;
          chat.unreadCounts       = chat.unreadCounts || {};
          chat.unreadCounts[key]  = prev + 1;
          chat.markModified('unreadCounts');
        }

        await chat.save();

        const message = chat.messages[chat.messages.length - 1];
        const msgObj  = message.toObject();

        // Broadcast to everyone in the chat room (both sender and recipient if joined)
        io.to(`chat:${chatId}`).emit('new_message', {
          chatId,
          message: { ...msgObj, senderName: socket.user.name },
        });

        // Always notify recipient's PERSONAL room so their sidebar updates
        // even if they haven't opened this specific chat
        if (otherId) {
          io.to(`user:${otherId}`).emit('chat_updated', {
            chatId,
            lastMessage: { text, createdAt: new Date() },
            senderId:    socket.user._id,
            senderName:  socket.user.name,
          });
          const notif = await Notification.create({
            recipient: otherId,
            type:      'message',
            text:      `New message from ${socket.user.name}`,
            actor:     socket.user._id,
            link:      `chat:${chatId}`,
          });
          // Emit full notification payload so frontend can render it live
          io.to(`user:${otherId}`).emit('notification', {
            _id:       notif._id,
            type:      'message',
            text:      notif.text,
            link:      notif.link,
            isRead:    false,
            createdAt: notif.createdAt,
            actor:     { name: socket.user.name, avatar: socket.user.avatar },
          });
        }
      } catch (err) {
        socket.emit('error', { message: 'Could not send message' });
      }
    });

    // ─── Typing indicators ────────────────────────────
    socket.on('typing_start', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing_start', {
        chatId, userId, name: socket.user.name,
      });
    });

    socket.on('typing_stop', ({ chatId }) => {
      socket.to(`chat:${chatId}`).emit('typing_stop', { chatId, userId });
    });

    // ─── Disconnect ───────────────────────────────────
    socket.on('disconnect', async () => {
      await User.findByIdAndUpdate(userId, { lastSeen: new Date() });
      io.emit('user_offline', { userId, lastSeen: new Date() });
    });
  });
}