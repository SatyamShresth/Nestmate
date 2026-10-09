// src/routes/admin.routes.js
import { Router } from 'express';
import {
  getDashboardStats,
  adminGetUsers,    adminUpdateUser,    adminDeleteUser,
  adminGetListings, adminUpdateListing, adminDeleteListing,
  adminGetReports,  adminResolveReport,
} from '../controllers/admin.controller.js';
import { protect, adminOnly } from '../middleware/auth.js';

const router = Router();

// ── Every admin route requires:
//    1. protect   → valid JWT + user exists + not banned
//    2. adminOnly → isAdmin:true re-checked live from DB
//
// Both guards are applied at the router level so no individual
// route can accidentally be left unprotected.
router.use(protect, adminOnly);

// ── Dashboard ─────────────────────────────────────────
router.get('/stats',            getDashboardStats);

// ── Users ─────────────────────────────────────────────
router.get('/users',            adminGetUsers);
router.patch('/users/:id',      adminUpdateUser);
router.delete('/users/:id',     adminDeleteUser);

// ── Listings ──────────────────────────────────────────
router.get('/listings',         adminGetListings);
router.patch('/listings/:id',   adminUpdateListing);
router.delete('/listings/:id',  adminDeleteListing);

// ── Reports ───────────────────────────────────────────
router.get('/reports',          adminGetReports);
router.patch('/reports/:id',    adminResolveReport);

export default router;
