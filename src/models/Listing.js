// src/models/Listing.js
import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
  owner:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title:       { type: String, required: true, maxlength: 120 },
  description: { type: String, maxlength: 2000 },
  rent:        { type: Number, required: true },
  deposit:     Number,
  roomType:    { type: String, enum: ['single', 'shared', 'entire_flat'], required: true },
  furnishing:  { type: String, enum: ['furnished', 'semi_furnished', 'unfurnished'], default: 'furnished' },

  // ─── Location ────────────────────────────────────────
  address:     String,
  city:        { type: String, required: true },
  area:        String,
  pincode:     String,
  coords: {
    type:        { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: [0, 0] }, // [lng, lat]
  },

  // ─── Amenities ───────────────────────────────────────
  amenities:   [{ type: String, enum: ['wifi', 'ac', 'gym', 'parking', 'pool', 'furnished',
                                        'balcony', 'washing_machine', 'meals', 'security'] }],

  // ─── Media ───────────────────────────────────────────
  images: [{
    url:      String,
    publicId: String,
  }],

  // ─── Availability ────────────────────────────────────
  availableFrom: Date,
  preferredGender: { type: String, enum: ['any', 'male', 'female'], default: 'any' },

  // ─── Status ──────────────────────────────────────────
  // available → visible to everyone (default)
  // booked    → flat taken; visible only to owner, hidden from public search
  // inactive  → owner paused it; hidden from public search
  // banned    → admin removed it
  status: {
    type:    String,
    enum:    ['available', 'booked', 'inactive', 'active', 'pending', 'rented', 'banned'],
    default: 'available',
  },
  views:      { type: Number, default: 0 },
  enquiries:  { type: Number, default: 0 },

}, { timestamps: true });

// ─── Geo index for "near me" queries ─────────────────
listingSchema.index({ coords: '2dsphere' });
listingSchema.index({ city: 1, rent: 1, status: 1 });
listingSchema.index({ title: 'text', description: 'text', city: 'text' });

export default mongoose.model('Listing', listingSchema);