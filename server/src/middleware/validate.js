/**
 * Factory that returns an Express middleware which validates `req[source]`
 * against the supplied Zod schema.
 *
 * On success the parsed (and coerced) value replaces `req[source]` so that
 * downstream handlers always receive clean, typed data.
 *
 * On ZodError the error is forwarded to `next(err)` so the global error
 * handler can convert it to a 400 VALIDATION_ERROR response.
 *
 * @param {import('zod').ZodTypeAny} schema
 * @param {'body' | 'query'} [source='body']
 */
export default function validate(schema, source = 'body') {
  return function validationMiddleware(req, res, next) {
    try {
      req[source] = schema.parse(req[source]);
      next();
    } catch (err) {
      // Pass ZodError (and anything else) straight to the global error handler.
      next(err);
    }
  };
}
