import Bug from '../models/Bug.js';
import BugEvent from '../models/BugEvent.js';
import { AppError } from '../utils/AppError.js';

/**
 * Explicit state-machine transitions table.
 * Any transition not listed here is illegal (422).
 */
export const TRANSITIONS = {
  open: ['in_progress', 'wontfix'],
  in_progress: ['open', 'fixed'],
  fixed: ['open'],
  wontfix: ['open'],
};

/**
 * Transition a Bug's status through the state machine.
 *
 * Uses optimistic concurrency: the conditional write filters on both __v
 * and the current status. If either has changed since the client read the
 * bug, the write returns null → 409.
 *
 * @param {string} bugId       Mongoose ObjectId
 * @param {string} toStatus    Target status
 * @param {string} memberId    User performing the transition
 * @param {number} version     Client-supplied __v for optimistic locking
 * @param {string} currentStatus  Current bug status (from middleware)
 * @returns {Promise<import('mongoose').Document>} Updated Bug
 */
export async function transition(bugId, toStatus, memberId, version, currentStatus) {
  // ── Validate against the state machine ────────────────────────────────────
  if (!TRANSITIONS[currentStatus]?.includes(toStatus)) {
    throw new AppError(422, 'ILLEGAL_TRANSITION', 'Illegal status transition');
  }

  // ── Optimistic concurrency write ──────────────────────────────────────────
  const bug = await Bug.findOneAndUpdate(
    { _id: bugId, __v: version, status: currentStatus },
    { $set: { status: toStatus }, $inc: { __v: 1 } },
    { new: true },
  );

  if (!bug) {
    throw new AppError(409, 'STALE_VERSION', 'Conflict: stale version');
  }

  // ── Append status_changed event ───────────────────────────────────────────
  await BugEvent.create({
    bug: bugId,
    project: bug.project,
    type: 'status_changed',
    from: currentStatus,
    to: toStatus,
    memberId,
  });

  return bug;
}
