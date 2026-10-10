import * as authService from '../services/authService.js';

/**
 * Attach the JWT as an HttpOnly cookie.
 * Kept in one place so signup and login stay in sync.
 *
 * @param {import('express').Response} res
 * @param {string} token
 */
function setTokenCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 86_400_000, // 24 h in ms
  });
}

/**
 * POST /api/auth/signup
 * Requirement 1.1 — create account, return 201 { id, email }
 */
export async function signup(req, res, next) {
  try {
    const { id, email, token } = await authService.signup(
      req.body.email,
      req.body.password,
    );
    setTokenCookie(res, token);
    res.status(201).json({ id, email });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Requirement 1.3 — authenticate, return 200 { id, email }
 */
export async function login(req, res, next) {
  try {
    const { id, email, token } = await authService.login(
      req.body.email,
      req.body.password,
    );
    setTokenCookie(res, token);
    res.status(200).json({ id, email });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 * Requirement 1.5 — clear cookie, return 204
 */
export function logout(req, res) {
  res.clearCookie('token');
  res.status(204).send();
}

/**
 * GET /api/auth/me
 * Requirement 1.6 — return current user; req.user is set by authenticate middleware
 */
export async function me(req, res, next) {
  try {
    const { id, email } = await authService.me(req.user.id);
    res.status(200).json({ id, email });
  } catch (err) {
    next(err);
  }
}
