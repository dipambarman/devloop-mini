import Bug from '../models/Bug.js';
import BugEvent from '../models/BugEvent.js';
import * as bugStateService from '../services/bugStateService.js';
import { AppError } from '../utils/AppError.js';

/**
 * GET /api/projects/:id/bugs — List bugs with optional filters and limit/skip.
 *
 * Filters: status, severity, assignee, search (case-insensitive title match).
 * Sorting: lastSeen descending, _id descending.
 * Pagination: simple limit/skip, default 50.
 */
export async function list(req, res, next) {
  try {
    const { status, severity, assignee, search, skip = 0, limit = 50 } = req.query;

    const filter = { project: req.project._id };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (assignee) filter.assignee = assignee;
    if (search) filter.title = { $regex: search, $options: 'i' };

    const [bugs, total] = await Promise.all([
      Bug.find(filter)
        .sort({ lastSeen: -1, _id: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Bug.countDocuments(filter),
    ]);

    res.json({ bugs, total });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/bugs/:bugId — Bug detail with full event timeline.
 *
 * requireMember (Mode B) already verified access and attached req.bug
 * (with project, status, __v). We re-query for the full document here.
 */
export async function detail(req, res, next) {
  try {
    const bug = await Bug.findById(req.params.bugId).lean();
    if (!bug) throw new AppError(404, 'NOT_FOUND', 'Not found');

    const events = await BugEvent.find({ bug: bug._id })
      .sort({ createdAt: 1, _id: 1 })
      .lean();

    res.json({ ...bug, events });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/bugs/:bugId — Update severity and/or assignee.
 *
 * Uses optimistic concurrency: conditional write on { _id, __v, status }.
 * The __v and status come from req.bug (loaded by requireMember middleware).
 * If the bug was modified between the middleware read and this write → 409.
 */
export async function patchMetadata(req, res, next) {
  try {
    const { severity, assignee } = req.body;
    const $set = {};
    if (severity !== undefined) $set.severity = severity;
    if (assignee !== undefined) $set.assignee = assignee;

    const bug = await Bug.findOneAndUpdate(
      { _id: req.bug._id, __v: req.bug.__v, status: req.bug.status },
      { $set, $inc: { __v: 1 } },
      { new: true },
    );

    if (!bug) {
      throw new AppError(409, 'STALE_VERSION', 'Conflict: stale version');
    }

    res.json(bug);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/bugs/:bugId/status — Transition status via the state machine.
 *
 * Delegates entirely to bugStateService.transition which validates the
 * transition, writes with optimistic concurrency, and appends a status_changed
 * event.
 */
export async function transitionStatus(req, res, next) {
  try {
    const { status: toStatus, version } = req.body;
    const bug = await bugStateService.transition(
      req.bug._id,
      toStatus,
      req.user.id,
      version,
      req.bug.status,
    );
    res.json(bug);
  } catch (err) {
    next(err);
  }
}
