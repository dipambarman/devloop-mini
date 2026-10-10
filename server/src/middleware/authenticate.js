import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError.js';

/**
 * Reads the `token` HttpOnly cookie, verifies it with JWT_SECRET, and attaches
 * `req.user = { id, email }` for downstream middleware and controllers.
 *
 * Returns 401 (UNAUTHORIZED) when the cookie is absent, the token is malformed,
 * or the token has expired. No 403 is ever returned — callers learn nothing
 * about why access was denied.
 */
export default function authenticate(req, res, next) {
  const token = req.cookies?.token;

  if (!token) {
    return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.sub, email: payload.email };
    next();
  } catch (err) {
    // JsonWebTokenError covers malformed / bad-signature tokens.
    // TokenExpiredError covers expired tokens.
    // Both are treated identically so callers can't distinguish the reason.
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return next(new AppError(401, 'UNAUTHORIZED', 'Unauthorized'));
    }
    // Unexpected verification failure — let the global error handler deal with it.
    next(err);
  }
}
