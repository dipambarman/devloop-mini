import { AppError } from '../utils/AppError.js';

// eslint-disable-next-line no-unused-vars
export default function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ error: err.message, code: err.code });
  }

  if (err.name === 'ZodError') {
    return res.status(400).json({
      error: err.errors[0].message,
      code: 'VALIDATION_ERROR',
    });
  }

  // Unexpected errors — log server-side, never leak internals to the client
  console.error(err);
  return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
}
