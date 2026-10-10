import Project from '../models/Project.js';
import User from '../models/User.js';
import { AppError } from '../utils/AppError.js';

/**
 * POST /api/projects — Create a project.
 * The requesting user becomes the owner.
 */
export async function create(req, res, next) {
  try {
    const project = await Project.create({
      name: req.body.name,
      owner: req.user.id,
    });

    res.status(201).json({
      id: project._id,
      name: project.name,
      owner: project.owner,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/projects — List projects the user owns or is a member of.
 */
export async function list(req, res, next) {
  try {
    const projects = await Project.find({
      $or: [{ owner: req.user.id }, { members: req.user.id }],
    })
      .populate('owner', 'email')
      .lean();

    res.json(projects);
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/projects/:id/members — Add a member by email (owner only).
 *
 * Non-owners get 404 (indistinguishable from non-existent project).
 * requireMember middleware already verified the user has access and
 * attached req.project.
 */
export async function addMember(req, res, next) {
  try {
    // Owner-only gate — non-owner members get 404
    if (!req.project.owner.equals(req.user.id)) {
      throw new AppError(404, 'NOT_FOUND', 'Not found');
    }

    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      throw new AppError(404, 'USER_NOT_FOUND', 'User not found');
    }

    // Already owner?
    if (req.project.owner.equals(user._id)) {
      throw new AppError(409, 'ALREADY_MEMBER', 'User is already part of the project');
    }

    // Already a member?
    if (req.project.members.some((m) => m.equals(user._id))) {
      throw new AppError(409, 'ALREADY_MEMBER', 'User is already part of the project');
    }

    req.project.members.push(user._id);
    await req.project.save();

    res.json({ id: user._id, email: user.email });
  } catch (err) {
    next(err);
  }
}
