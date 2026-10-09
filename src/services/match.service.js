// src/services/match.service.js
//
// Compatibility algorithm:
//  - Lifestyle fields are weighted (see WEIGHTS below)
//  - Budget overlap adds points
//  - City match is required
//
// Returns a score 0–100.

const WEIGHTS = {
  smoking:     20,
  drinking:    15,
  pets:        15,
  sleep:       15,
  cleanliness: 20,
  food:        15,
};

/**
 * @param {Object} a – User document A
 * @param {Object} b – User document B
 * @returns {number} – score 0-100
 */
export function computeMatchScore(a, b) {
  if (!a?.lifestyle || !b?.lifestyle) return 0;

  let score = 0;
  const total = Object.values(WEIGHTS).reduce((s, w) => s + w, 0); // 100

  for (const [key, weight] of Object.entries(WEIGHTS)) {
    const va = a.lifestyle[key];
    const vb = b.lifestyle[key];
    if (!va || !vb) continue;

    if (va === vb) {
      score += weight;
    } else if (isPartialMatch(key, va, vb)) {
      score += weight * 0.5;
    }
  }

  // Budget overlap bonus (up to 5 bonus points, capped at 100)
  const budgetBonus = budgetOverlapBonus(
    a.budgetMin, a.budgetMax,
    b.budgetMin, b.budgetMax
  );
  score = Math.min(100, Math.round((score / total) * 95 + budgetBonus));
  return score;
}

function isPartialMatch(key, va, vb) {
  const partials = {
    drinking:    [['occasionally', 'no']],          // occasionally ≈ no
    cleanliness: [['very_clean', 'moderate']],       // very_clean ≈ moderate
    sleep:       [['early_bird', 'flexible'],
                  ['night_owl',  'flexible']],       // flexible ≈ anything
  };
  if (!partials[key]) return false;
  return partials[key].some(
    ([x, y]) => (va === x && vb === y) || (va === y && vb === x)
  );
}

function budgetOverlapBonus(aMin, aMax, bMin, bMax) {
  if (!aMin || !aMax || !bMin || !bMax) return 0;
  const overlapLow  = Math.max(aMin, bMin);
  const overlapHigh = Math.min(aMax, bMax);
  if (overlapHigh < overlapLow) return 0;  // no overlap
  const overlapFraction = (overlapHigh - overlapLow) / Math.max(aMax - aMin, bMax - bMin, 1);
  return Math.round(overlapFraction * 5);
}

/**
 * Find top-N compatible users for a given user.
 * @param {Object}   currentUser  – populated User document
 * @param {Object[]} candidates   – array of User documents
 * @param {number}   limit        – max results
 */
export function rankMatches(currentUser, candidates, limit = 20) {
  return candidates
    .filter(c => c._id.toString() !== currentUser._id.toString())
    .filter(c => !currentUser.blockedUsers?.includes(c._id.toString()))
    .filter(c => !currentUser.city || c.city === currentUser.city)
    .map(c => ({ user: c, score: computeMatchScore(currentUser, c) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
