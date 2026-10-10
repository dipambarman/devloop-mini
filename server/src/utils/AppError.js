export class AppError extends Error {
  /**
   * @param {number} statusCode - HTTP status code
   * @param {string} code - Screaming-snake error code for the client (e.g. 'UNAUTHORIZED')
   * @param {string} [message] - Human-readable message; defaults to the code if omitted
   */
  constructor(statusCode, code, message) {
    super(message || code);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    // Preserve the real stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }
  }
}
