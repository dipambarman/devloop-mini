import mongoose from 'mongoose';

const bugEventSchema = new mongoose.Schema({
  bug: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bug',
    required: true,
  },
  // Denormalised for query efficiency — avoids joining through Bug to get project
  project: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Project',
    required: true,
  },
  type: {
    type: String,
    enum: ['occurrence', 'status_changed'],
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },

  // occurrence payload
  occurrenceCount: { type: Number },

  // status_changed payload
  from: { type: String },
  to: { type: String },
  memberId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

// Timeline fetch: ascending by createdAt with _id as tiebreaker
bugEventSchema.index({ bug: 1, createdAt: 1, _id: 1 });

export default mongoose.model('BugEvent', bugEventSchema);
