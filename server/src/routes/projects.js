import { Router } from 'express';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import requireMember from '../middleware/requireMember.js';
import * as projectController from '../controllers/projectController.js';
import * as bugController from '../controllers/bugController.js';
import * as ingestController from '../controllers/ingestController.js';
import { projectSchema, addMemberSchema, bugListQuery, ingestSchema } from './schemas.js';

const router = Router();

// Protect all project routes
router.use(authenticate);

// POST /api/projects — Requirement 2.1
router.post('/', validate(projectSchema), projectController.create);

// GET /api/projects — Requirement 2.2
router.get('/', projectController.list);

// POST /api/projects/:id/members — Requirement 2.3
router.post(
  '/:id/members',
  requireMember,
  validate(addMemberSchema),
  projectController.addMember,
);

// GET /api/projects/:id/bugs — Requirement 7.1
router.get(
  '/:id/bugs',
  requireMember,
  validate(bugListQuery, 'query'),
  bugController.list,
);

// POST /api/projects/:id/ingest — Requirement 4.1
router.post(
  '/:id/ingest',
  requireMember,
  validate(ingestSchema),
  ingestController.member,
);

export default router;
