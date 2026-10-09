// src/server.js
import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import dns from 'dns';
dns.setServers(["1.1.1.1", "8.8.8.8"]);
import connectDB from './config/db.js';
import { registerSocketHandlers } from './socket/index.js';

// ─── Route imports ────────────────────────────────────
import authRoutes     from './routes/auth.routes.js';
import userRoutes     from './routes/user.routes.js';
import listingRoutes  from './routes/listing.routes.js';
import matchRoutes    from './routes/match.routes.js';
import chatRoutes     from './routes/chat.routes.js';
import notifRoutes    from './routes/notification.routes.js';
import adminRoutes    from './routes/admin.routes.js';
import uploadRoutes   from './routes/upload.routes.js';

// ─── App setup ────────────────────────────────────────
import path from 'path';
const app = express();
const httpServer = createServer(app);
app.use(express.static('public'));
app.get('/', (req,res) => res.sendFile(path.resolve('public/index.html')));



// ─── Socket.io ────────────────────────────────────────
const io = new Server(httpServer, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});
registerSocketHandlers(io);

// ─── Middleware ───────────────────────────────────────
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));
app.use(morgan('dev'));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());

// Global rate limiter (100 req / 15 min per IP)
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please slow down.' },
}));

// ─── Routes ───────────────────────────────────────────
app.use('/api/auth',          authRoutes);
app.use('/api/users',         userRoutes);
app.use('/api/listings',      listingRoutes);
app.use('/api/matches',       matchRoutes);
app.use('/api/chats',         chatRoutes);
app.use('/api/notifications', notifRoutes);
app.use('/api/admin',         adminRoutes);
app.use('/api/upload',        uploadRoutes);

// ─── Health check ─────────────────────────────────────
app.get('/health', (_, res) => res.json({ status: 'ok' }));

// ─── Global error handler ─────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal Server Error',
  });
});

// ─── Bootstrap ────────────────────────────────────────
const PORT = process.env.PORT || 5000;

connectDB().then(() => {
  httpServer.listen(PORT, () =>
    console.log(`🚀 NestMate server running on port ${PORT}`)
  );
});

export { io }; // export so controllers can emit events
