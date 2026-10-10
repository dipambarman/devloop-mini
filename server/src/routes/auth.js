import { Router } from 'express';
import validate from '../middleware/validate.js';
import authenticate from '../middleware/authenticate.js';
import * as authController from '../controllers/authController.js';
import { signupSchema, loginSchema } from './schemas.js';

const router = Router();

// POST /api/auth/signup — Requirement 1.1
router.post('/signup', validate(signupSchema), authController.signup);

// POST /api/auth/login — Requirement 1.3
router.post('/login', validate(loginSchema), authController.login);

// POST /api/auth/logout — Requirement 1.5
router.post('/logout', authenticate, authController.logout);

// GET /api/auth/me — Requirement 1.6
router.get('/me', authenticate, authController.me);

export default router;
