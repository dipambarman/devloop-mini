import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';
import { JWT_SECRET } from '../config/env.js';

/**
 * Sign a JWT for the given user.
 * Payload follows the design spec: { sub, email }. Expiry: 24 h.
 *
 * @param {import('mongoose').Document} user
 * @returns {string} signed JWT
 */
function signToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), email: user.email },
    JWT_SECRET,
    { expiresIn: '24h' },
  );
}

/**
 * Create a new user account.
 *
 * @param {string} email
 * @param {string} password  plaintext — bcrypt-hashed before storage
 * @returns {{ id: string, email: string, token: string }}
 * @throws {AppError} 409 EMAIL_TAKEN if the email is already registered
 */
export async function signup(email, password) {
  const existing = await User.findOne({ email });
  if (existing) {
    throw new AppError(409, 'EMAIL_TAKEN', 'Email already registered');
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const user = await User.create({ email, passwordHash });

  const token = signToken(user);
  return { id: user._id.toString(), email: user.email, token };
}

/**
 * Authenticate an existing user.
 *
 * @param {string} email
 * @param {string} password  plaintext — compared against stored hash
 * @returns {{ id: string, email: string, token: string }}
 * @throws {AppError} 401 INVALID_CREDENTIALS if email not found or password wrong
 */
export async function login(email, password) {
  const user = await User.findOne({ email });
  if (!user) {
    // Use a generic error so the caller cannot enumerate registered emails
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    throw new AppError(401, 'INVALID_CREDENTIALS', 'Invalid credentials');
  }

  const token = signToken(user);
  return { id: user._id.toString(), email: user.email, token };
}

/**
 * Retrieve the current user by ID (used by the /auth/me route after the
 * authenticate middleware has already verified the JWT).
 *
 * @param {string} userId  Mongoose ObjectId as a string
 * @returns {{ id: string, email: string }}
 * @throws {AppError} 401 UNAUTHORIZED if the user record no longer exists
 */
export async function me(userId) {
  const user = await User.findById(userId);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Unauthorized');
  }

  return { id: user._id.toString(), email: user.email };
}
