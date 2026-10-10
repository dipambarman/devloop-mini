import { Router } from 'express';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import requireMember from '../middleware/requireMember.js';
import * as bugController from '../controllers/bugController.js';
import { bugPatchSchema, statusSchema } from './schemas.js';

const router = Router();

// Protect all bug routes
router.use(authenticate);

// All these routes use :bugId, so requireMember will operate in Mode B.

// GET /api/bugs/:bugId — Requirement 8.1
router.get('/:bugId', requireMember, bugController.detail);

// PATCH /api/bugs/:bugId — Requirement 9.1
router.patch(
  '/:bugId',
  requireMember,
  validate(bugPatchSchema),
  bugController.patchMetadata,
);

// POST /api/bugs/:bugId/status — Requirement 10.1
router.post(
  '/:bugId/status',
  requireMember,
  validate(statusSchema),
  bugController.transitionStatus,
);

export default router;
