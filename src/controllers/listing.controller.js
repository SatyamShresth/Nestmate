// src/controllers/listing.controller.js
import Listing from '../models/Listing.js';
import { cloudinary } from '../config/cloudinary.js';
import { Notification } from '../models/Notification.js';
import User from '../models/User.js';

// ─── GET /api/listings ────────────────────────────────
// Browse with filters, pagination, geo-search
export async function getListings(req, res, next) {
  try {
    const {
      city, rentMin, rentMax, roomType, furnishing,
      amenities, preferredGender, availableFrom,
      search, page = 1, limit = 12, sort = 'newest',
      lat, lng, radius = 10000, // radius in metres
    } = req.query;

    // Accept both 'available' (new) and 'active' (legacy) listings
    const filter = { status: { $in: ['available', 'active'] } };

    // Geo-query (near me) takes priority over city text filter
    if (lat && lng) {
      filter.coords = {
        $near: {
          $geometry:    { type: 'Point', coordinates: [Number(lng), Number(lat)] },
          $maxDistance: Number(radius),
        },
      };
    } else if (city) {
      filter.city = new RegExp(city, 'i');
    }

    if (rentMin) filter.rent = { ...filter.rent, $gte: Number(rentMin) };
    if (rentMax) filter.rent = { ...filter.rent, $lte: Number(rentMax) };
    if (roomType)       filter.roomType       = roomType;
    if (furnishing)     filter.furnishing     = furnishing;
    if (preferredGender && preferredGender !== 'any') {
      filter.$or = [{ preferredGender: 'any' }, { preferredGender }];
    }
    if (availableFrom)  filter.availableFrom  = { $lte: new Date(availableFrom) };
    if (amenities) {
      const list = Array.isArray(amenities) ? amenities : amenities.split(',');
      filter.amenities = { $all: list };
    }
    if (search) filter.$text = { $search: search };

    const sortMap = {
      newest:   { createdAt: -1 },
      cheapest: { rent: 1 },
      priciest: { rent: -1 },
      popular:  { views: -1 },
    };

    const skip = (Number(page) - 1) * Number(limit);

    const [listings, total] = await Promise.all([
      Listing.find(filter)
        .populate('owner', 'name avatar city isVerified')
        .sort(sortMap[sort] || sortMap.newest)
        .skip(skip)
        .limit(Number(limit)),
      Listing.countDocuments(filter),
    ]);

    res.json({
      success: true,
      data: listings,
      pagination: { total, page: Number(page), pages: Math.ceil(total / Number(limit)) },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/listings/:id ────────────────────────────
export async function getListingById(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('owner', 'name avatar city occupation isVerified lastSeen');
      // phone intentionally excluded — use GET /api/listings/:id/contact

    if (!listing || listing.status === 'banned') {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    const ownerId  = listing.owner?._id?.toString() || listing.owner?.toString();
    const userId   = req.user?._id?.toString();
    const isOwner  = userId && ownerId === userId;
    const isPublic = ['available', 'active'].includes(listing.status);
    if (!isOwner && !isPublic) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    Listing.findByIdAndUpdate(req.params.id, { $inc: { views: 1 } }).exec();
    res.json({ success: true, data: listing });
  } catch (err) { next(err); }
}

// ─── GET /api/listings/:id/contact ───────────────────────────
// Returns owner phone only to authenticated users.
// Phone is never exposed in the public listing response.
export async function getListingContact(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id)
      .populate('owner', 'name phone');

    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    if (listing.status === 'banned') {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }

    const phone = listing.owner?.phone;
    res.json({
      success: true,
      data: {
        ownerName: listing.owner?.name || 'Owner',
        phone:     phone || null,
        hasPhone:  !!phone,
      },
    });
  } catch (err) { next(err); }
}

// ─── POST /api/listings ───────────────────────────────
export async function createListing(req, res, next) {
  try {
    const {
      title, description, rent, deposit, roomType, furnishing,
      address, city, area, pincode, lat, lng,
      amenities, availableFrom, preferredGender,
      images,   // [{url, publicId}] — pre-uploaded to Cloudinary by frontend
    } = req.body;

    // amenities can arrive as a JS array (fetch/JSON) or a JSON string (FormData)
    let amenitiesList = [];
    if (Array.isArray(amenities))         amenitiesList = amenities;
    else if (typeof amenities === 'string' && amenities) {
      try { amenitiesList = JSON.parse(amenities); } catch { amenitiesList = amenities.split(',').map(s=>s.trim()).filter(Boolean); }
    }

    // images can arrive as [{url,publicId}] array or JSON string
    let imagesList = [];
    if (Array.isArray(images))            imagesList = images;
    else if (typeof images === 'string' && images) {
      try { imagesList = JSON.parse(images); } catch { imagesList = []; }
    }

    const listing = await Listing.create({
      owner:           req.user._id,
      title, description, rent, deposit,
      roomType, furnishing, address, city, area, pincode,
      coords: {
        type:        'Point',
        coordinates: [Number(lng) || 0, Number(lat) || 0],
      },
      amenities:       amenitiesList,
      images:          imagesList,
      availableFrom:   availableFrom ? new Date(availableFrom) : undefined,
      preferredGender: preferredGender || 'any',
      status:          'available',  // visible to everyone immediately
    });

    // Notify users who want listings in this city
    const interestedUsers = await User.find({
      city:   new RegExp(city, 'i'),
      status: 'active',
      _id:    { $ne: req.user._id },
    }).select('_id').limit(100);

    if (interestedUsers.length) {
      await Notification.insertMany(
        interestedUsers.map(u => ({
          recipient: u._id,
          type:      'listing',
          text:      `New listing in ${city}: "${title}"`,
          actor:     req.user._id,
          link:      `/listings/${listing._id}`,
        }))
      );
    }

    res.status(201).json({ success: true, data: listing });
  } catch (err) { next(err); }
}

// ─── PATCH /api/listings/:id ──────────────────────────
export async function updateListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    if (!listing.owner.equals(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const allowed = [
      'title', 'description', 'rent', 'deposit', 'roomType', 'furnishing',
      'address', 'city', 'area', 'pincode', 'amenities',
      'availableFrom', 'preferredGender',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Owner can update status between available / booked / inactive
    // Admin can set any status including banned
    const OWNER_STATUS = ['available', 'booked', 'inactive'];
    if (req.body.status !== undefined) {
      if (req.user.isAdmin) {
        updates.status = req.body.status;
      } else if (OWNER_STATUS.includes(req.body.status)) {
        updates.status = req.body.status;
      }
      // If editing other fields without status change, don't reset to pending
    }

    const updated = await Listing.findByIdAndUpdate(
      req.params.id, { $set: updates }, { new: true, runValidators: true }
    ).populate('owner', 'name avatar');

    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
}

// ─── DELETE /api/listings/:id ─────────────────────────
export async function deleteListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    if (!listing.owner.equals(req.user._id) && !req.user.isAdmin) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    // Delete all images from Cloudinary
    for (const img of listing.images) {
      if (img.publicId) await cloudinary.uploader.destroy(img.publicId);
    }

    await listing.deleteOne();
    res.json({ success: true, message: 'Listing deleted' });
  } catch (err) { next(err); }
}

// ─── POST /api/listings/:id/images ───────────────────
// Upload images (handled by Cloudinary middleware)
export async function uploadListingImages(req, res, next) {
  try {
    if (!req.files?.length) {
      return res.status(400).json({ success: false, error: 'No images uploaded' });
    }

    const listing = await Listing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ success: false, error: 'Listing not found' });
    }
    if (!listing.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const newImages = req.files.map(f => ({ url: f.path, publicId: f.filename }));
    listing.images.push(...newImages);
    await listing.save();

    res.json({ success: true, data: listing.images });
  } catch (err) { next(err); }
}

// ─── DELETE /api/listings/:id/images/:publicId ───────
export async function deleteListingImage(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id);
    if (!listing || !listing.owner.equals(req.user._id)) {
      return res.status(403).json({ success: false, error: 'Forbidden' });
    }

    const publicId = decodeURIComponent(req.params.publicId);
    await cloudinary.uploader.destroy(publicId);
    listing.images = listing.images.filter(i => i.publicId !== publicId);
    await listing.save();

    res.json({ success: true, data: listing.images });
  } catch (err) { next(err); }
}

// ─── GET /api/listings/me ─────────────────────────────
export async function getMyListings(req, res, next) {
  try {
    const listings = await Listing.find({
      owner:  req.user._id,
      status: { $ne: 'banned' },        // show everything except admin-banned
    }).sort({ createdAt: -1 });
    res.json({ success: true, data: listings });
  } catch (err) { next(err); }
}

// ─── POST /api/listings/:id/save ─────────────────────
export async function saveListing(req, res, next) {
  try {
    const listingId = req.params.id;
    const user = await User.findById(req.user._id).select('savedListings');
    const already = user.savedListings.map(String).includes(listingId);
    const op = already ? '$pull' : '$push';
    await User.findByIdAndUpdate(req.user._id, { [op]: { savedListings: listingId } });
    res.json({ success: true, saved: !already });
  } catch (err) { next(err); }
}

// ─── POST /api/listings/:id/enquire ──────────────────
export async function enquireListing(req, res, next) {
  try {
    const listing = await Listing.findById(req.params.id).populate('owner', '_id name');
    if (!listing) return res.status(404).json({ success: false, error: 'Listing not found' });

    await Listing.findByIdAndUpdate(req.params.id, { $inc: { enquiries: 1 } });

    await Notification.create({
      recipient: listing.owner._id,
      type:      'message',
      text:      `${req.user.name} enquired about your listing: "${listing.title}"`,
      actor:     req.user._id,
      link:      `/listings/${listing._id}`,
    });

    res.json({ success: true, message: 'Enquiry sent' });
  } catch (err) { next(err); }
}