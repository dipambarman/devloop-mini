import Bug from '../models/Bug.js';
import BugEvent from '../models/BugEvent.js';
import { fingerprint, normalizeMessage } from '../utils/fingerprint.js';
import { AppError } from '../utils/AppError.js';

/**
 * Extract an error type prefix from the message (e.g. "TypeError: ..." → "TypeError").
 * Returns undefined if no recognisable pattern is found.
 */
function extractErrorType(message) {
  const match = message.match(/^([A-Z][a-zA-Z]*Error)\b/);
  return match ? match[1] : undefined;
}

/**
 * Core ingest function shared by the member ingest route.
 *
 * 1. Fingerprint the error
 * 2. Atomic upsert (with one DuplicateKey retry)
 * 3. Regression detection (fixed → open)
 * 4. Append BugEvents
 *
 * @param {import('mongoose').Types.ObjectId} projectId
 * @param {string} message  Raw error message
 * @param {string} stack    Raw stack trace
 * @returns {Promise<import('mongoose').Document>} The upserted Bug
 */
export async function ingest(projectId, message, stack) {
  const errorType = extractErrorType(message);
  const fp = fingerprint(message, errorType, stack);
  const title = normalizeMessage(message).slice(0, 120);
  const now = new Date();

  // ── Step 1: Atomic upsert ─────────────────────────────────────────────────
  let bug;
  const upsertOp = () =>
    Bug.findOneAndUpdate(
      { project: projectId, fingerprint: fp },
      {
        $setOnInsert: { title, errorType: errorType || 'UnknownError', createdAt: now },
        $inc: { occurrenceCount: 1 },
        $set: { lastSeen: now },
      },
      { upsert: true, new: true, runValidators: true },
    );

  try {
    bug = await upsertOp();
  } catch (err) {
    // ── Step 2: Retry once on DuplicateKeyError (narrow race window) ──────
    if (err.code === 11000) {
      try {
        bug = await upsertOp();
      } catch (retryErr) {
        throw new AppError(500, 'INTERNAL_ERROR', 'Ingest failed after retry');
      }
    } else {
      throw err;
    }
  }

  // ── Step 3: Regression (fixed → open) ─────────────────────────────────────
  // WHY merged $inc: duplicate keys in a MongoDB update object silently
  // overwrite — { $inc: { regressions: 1 }, $inc: { __v: 1 } } would lose
  // the regressions increment. Both keys must be in one $inc object.
  if (bug.status === 'fixed') {
    const updated = await Bug.findOneAndUpdate(
      { _id: bug._id, __v: bug.__v, status: 'fixed' },
      { $set: { status: 'open' }, $inc: { regressions: 1, __v: 1 } },
      { new: true },
    );

    if (!updated) {
      throw new AppError(500, 'INTERNAL_ERROR', 'Regression update failed');
    }

    bug = updated;

    // Status event sorts 1 ms before the occurrence event so the timeline
    // shows "reopened" then "occurred" when sorted by (createdAt, _id)
    await BugEvent.create({
      bug: bug._id,
      project: projectId,
      type: 'status_changed',
      from: 'fixed',
      to: 'open',
      createdAt: new Date(now.getTime() - 1),
    });
  }

  // ── Step 4: Append occurrence event ───────────────────────────────────────
  // NOTE: This is a separate MongoDB operation from the upsert above.
  // A crash between them leaves the Bug updated but missing the event.
  // See README Design Notes for the rationale behind this trade-off.
  await BugEvent.create({
    bug: bug._id,
    project: projectId,
    type: 'occurrence',
    occurrenceCount: bug.occurrenceCount,
    createdAt: now,
  });

  return bug;
}
