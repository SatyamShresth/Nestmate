// src/routes/upload.routes.js
import { Router } from 'express';
import { protect } from '../middleware/auth.js';
import { uploadAvatar, uploadListing, cloudinary } from '../config/cloudinary.js';

const router = Router();
router.use(protect);

// ─── POST /api/upload/avatar ──────────────────────────
router.post('/avatar', uploadAvatar.single('avatar'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  res.json({
    success:  true,
    url:      req.file.path,
    publicId: req.file.filename,
  });
});

// ─── POST /api/upload/listing-images ─────────────────
// Uploads up to 6 listing images; returns URLs + publicIds.
router.post('/listing-images', uploadListing.array('images', 6), (req, res) => {
  if (!req.files?.length) {
    return res.status(400).json({ success: false, error: 'No files uploaded' });
  }
  res.json({
    success: true,
    images: req.files.map(f => ({ url: f.path, publicId: f.filename })),
  });
});

// ─── DELETE /api/upload/listing-image/:publicId ───────
// Deletes an orphan listing image from Cloudinary when user removes it
// from the grid before publishing (so it doesn't remain in Cloudinary forever).
router.delete('/listing-image/:publicId', async (req, res, next) => {
  try {
    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);
    res.json({ success: true });
  } catch (err) { next(err); }
});

export default router;