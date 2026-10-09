// src/routes/notification.routes.js
import { Router } from 'express';
import {
  getNotifications, markRead, markAllRead,
  deleteNotification, clearNotifications, submitReport,
} from '../controllers/notification.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET  /api/notifications?page=1&limit=20&unreadOnly=true
router.get('/',                   getNotifications);

// PATCH /api/notifications/read-all  ← must be before /:id
router.patch('/read-all',         markAllRead);

// PATCH /api/notifications/:id/read
router.patch('/:id/read',         markRead);

// DELETE /api/notifications  (clear all)
router.delete('/',                clearNotifications);

// DELETE /api/notifications/:id
router.delete('/:id',             deleteNotification);

// POST /api/notifications/report
router.post('/report',            submitReport);

export default router;
