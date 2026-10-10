import mongoose from 'mongoose';

const bugSchema = new mongoose.Schema({
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  fingerprint: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['open', 'in_progress', 'fixed', 'wontfix'],
    default: 'open',
  },
  severity: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  assignee: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  occurrenceCount: {
    type: Number,
    default: 0,
  },
  regressions: {
    type: Number,
    default: 0,
  },
  lastSeen: {
    type: Date,
    default: Date.now,
  },
  errorType: {
    type: String,
    default: 'UnknownError',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// One Bug per distinct failure per project — the source of truth for deduplication
bugSchema.index({ project: 1, fingerprint: 1 }, { unique: true });

// Default sort for bug list
bugSchema.index({ project: 1, lastSeen: -1 });

// Filter query support
bugSchema.index({ project: 1, status: 1 });
bugSchema.index({ project: 1, severity: 1 });

export default mongoose.model('Bug', bugSchema);
