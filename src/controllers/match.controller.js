// src/controllers/match.controller.js
import User from '../models/User.js';
import { rankMatches, computeMatchScore } from '../services/match.service.js';

// ─── GET /api/matches ─────────────────────────────────
// Returns ranked compatible roommate suggestions for the current user
export async function getMatches(req, res, next) {
  try {
    const { limit = 20, page = 1 } = req.query;

    // Fetch current user with full lifestyle data
    const currentUser = await User.findById(req.user._id);

    // Fetch candidates in same city, active accounts, excluding blocked
    const candidates = await User.find({
      _id:    { $ne: currentUser._id, $nin: currentUser.blockedUsers },
      status: 'active',
      city:   currentUser.city || { $exists: true },
    }).select('name avatar age gender occupation bio city budgetMin budgetMax lifestyle isVerified lastSeen');

    // Score and rank
    const ranked = rankMatches(currentUser, candidates, Number(limit) * Number(page));

    // Paginate
    const start = (Number(page) - 1) * Number(limit);
    const paginated = ranked.slice(start, start + Number(limit));

    res.json({
      success: true,
      data: paginated.map(({ user, score }) => ({
        ...user.toObject(),
        matchScore: score,
      })),
      pagination: {
        total: ranked.length,
        page:  Number(page),
        pages: Math.ceil(ranked.length / Number(limit)),
      },
    });
  } catch (err) { next(err); }
}

// ─── GET /api/matches/:id ─────────────────────────────
// Returns compatibility score + breakdown between current user and another user
export async function getMatchScore(req, res, next) {
  try {
    const [currentUser, targetUser] = await Promise.all([
      User.findById(req.user._id),
      User.findById(req.params.id),
    ]);

    if (!targetUser) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    const score = computeMatchScore(currentUser, targetUser);

    // Build field-by-field breakdown
    const fields = ['smoking', 'drinking', 'pets', 'sleep', 'cleanliness', 'food'];
    const breakdown = fields.map(key => ({
      field:   key,
      yours:   currentUser.lifestyle?.[key],
      theirs:  targetUser.lifestyle?.[key],
      match:   currentUser.lifestyle?.[key] === targetUser.lifestyle?.[key],
    }));

    // Budget overlap
    const budgetOverlap =
      currentUser.budgetMin <= targetUser.budgetMax &&
      currentUser.budgetMax >= targetUser.budgetMin;

    res.json({
      success: true,
      data: { score, breakdown, budgetOverlap },
    });
  } catch (err) { next(err); }
}
