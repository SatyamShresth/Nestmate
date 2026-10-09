// src/config/cloudinary.js
import { v2 as cloudinary } from 'cloudinary';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import multer from 'multer';

console.log("CLOUD NAME =", process.env.CLOUDINARY_CLOUD_NAME);
console.log("API KEY =", process.env.CLOUDINARY_API_KEY ? "FOUND" : "MISSING");
console.log("API SECRET =", process.env.CLOUDINARY_API_SECRET ? "FOUND" : "MISSING");
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key:    process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// ─── Avatar storage ──────────────────────────────────
const avatarStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'nestmate/avatars',
    allowed_formats: ['jpg', 'png', 'webp'],
    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
  },
});

// ─── Listing image storage ────────────────────────────
const listingStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder:         'nestmate/listings',
    allowed_formats: ['jpg', 'png', 'webp'],
    transformation: [{ width: 1200, height: 800, crop: 'fill' }],
  },
});

export const uploadAvatar  = multer({ storage: avatarStorage });
export const uploadListing = multer({ storage: listingStorage, limits: { files: 6 } });
export { cloudinary };
