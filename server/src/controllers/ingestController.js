import * as ingestService from '../services/ingestService.js';

/**
 * POST /api/projects/:id/ingest — Member ingest route.
 *
 * requireMember (Mode A) already verified membership and attached req.project.
 * Delegates to ingestService.ingest for fingerprinting, upserting, regression
 * handling, and event recording.
 */
export async function member(req, res, next) {
  try {
    const { message, stack } = req.body;
    const bug = await ingestService.ingest(req.project._id, message, stack);

    res.json({
      id: bug._id,
      fingerprint: bug.fingerprint,
      occurrenceCount: bug.occurrenceCount,
      status: bug.status,
      regressions: bug.regressions,
    });
  } catch (err) {
    next(err);
  }
}
