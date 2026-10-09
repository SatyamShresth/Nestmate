// src/routes/listing.routes.js
import { Router } from 'express';
import {
  getListings, getListingById, getListingContact, createListing, updateListing,
  deleteListing, uploadListingImages, deleteListingImage,
  getMyListings, saveListing, enquireListing,
} from '../controllers/listing.controller.js';
import { protect } from '../middleware/auth.js';
import { uploadListing } from '../config/cloudinary.js';

const router = Router();

// ─── Public routes ─────────────────────────────────────
router.get('/',        getListings);

// ─── Protected routes (no wildcard conflict) ───────────
// IMPORTANT: /me/all must be registered BEFORE /:id
// otherwise Express treats "me" as a listing _id
router.get('/me/all',  protect, getMyListings);

// Public single listing (owner check happens inside controller)
router.get('/:id',          getListingById);

// ── Requires auth ─────────────────────────────────────
// GET /api/listings/:id/contact — returns owner phone to logged-in users only
router.get('/:id/contact',  protect, getListingContact);

// All remaining routes require auth
router.post('/',                protect, createListing);
router.patch('/:id',            protect, updateListing);
router.delete('/:id',           protect, deleteListing);

router.post('/:id/images',      protect, uploadListing.array('images', 6), uploadListingImages);
router.delete('/:id/images/:publicId', protect, deleteListingImage);

router.post('/:id/save',        protect, saveListing);
router.post('/:id/enquire',     protect, enquireListing);

export default router;