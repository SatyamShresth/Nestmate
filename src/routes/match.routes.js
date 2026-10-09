// src/routes/match.routes.js
import { Router } from 'express';
import { getMatches, getMatchScore } from '../controllers/match.controller.js';
import { protect } from '../middleware/auth.js';

const router = Router();
router.use(protect);

// GET /api/matches?page=1&limit=20
// Returns top compatible roommates ranked by score
router.get('/', getMatches);

// GET /api/matches/:id
// Returns score + lifestyle breakdown vs a specific user
router.get('/:id', getMatchScore);

export default router;
