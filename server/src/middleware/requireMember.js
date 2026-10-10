import Bug from '../models/Bug.js';
import Project from '../models/Project.js';
import { AppError } from '../utils/AppError.js';

/**
 * Single reusable authorization middleware with two resolution modes:
 *
 * Mode A — project-scoped (:id param):
 *   Loads Project by ID, checks owner + members.
 *   Attaches req.project.
 *
 * Mode B — bug-scoped (:bugId param):
 *   Loads Bug (selecting project, status, __v for downstream use), then
 *   loads the Bug's Project and checks membership.
 *   Attaches req.bug and req.project.
 *
 * Non-members get 404 (identical to "does not exist") — never 403.
 * Never reads projectId from req.body or req.query.
 */
export default async function requireMember(req, res, next) {
  try {
    let project;

    if (req.params.bugId) {
      // ── Mode B: bug-scoped ──────────────────────────────────────────────
      const bug = await Bug.findById(req.params.bugId).select('project status __v');
      if (!bug) {
        return next(new AppError(404, 'NOT_FOUND', 'Not found'));
      }

      project = await Project.findById(bug.project);
      if (!project) {
        return next(new AppError(404, 'NOT_FOUND', 'Not found'));
      }

      req.bug = bug;
    } else if (req.params.id) {
      // ── Mode A: project-scoped ──────────────────────────────────────────
      project = await Project.findById(req.params.id);
      if (!project) {
        return next(new AppError(404, 'NOT_FOUND', 'Not found'));
      }
    } else {
      return next(new AppError(404, 'NOT_FOUND', 'Not found'));
    }

    // Membership check: owner OR member
    const userId = req.user.id;
    const isMember =
      project.owner.equals(userId) ||
      project.members.some((m) => m.equals(userId));

    if (!isMember) {
      return next(new AppError(404, 'NOT_FOUND', 'Not found'));
    }

    req.project = project;
    next();
  } catch (err) {
    // Invalid ObjectId format → treat as not-found, not as a 500
    if (err.name === 'CastError') {
      return next(new AppError(404, 'NOT_FOUND', 'Not found'));
    }
    next(err);
  }
}
