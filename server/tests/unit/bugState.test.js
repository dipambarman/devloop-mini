import { jest } from '@jest/globals';
import * as bugStateService from '../../src/services/bugStateService.js';
import Bug from '../../src/models/Bug.js';
import BugEvent from '../../src/models/BugEvent.js';
import { AppError } from '../../src/utils/AppError.js';

// Mock Mongoose models
jest.unstable_mockModule('../../src/models/Bug.js', () => ({
  default: { findOneAndUpdate: jest.fn() },
}));
jest.unstable_mockModule('../../src/models/BugEvent.js', () => ({
  default: { create: jest.fn() },
}));

describe('bugStateService', () => {
  beforeEach(() => {
    Bug.findOneAndUpdate.mockReset();
    BugEvent.create.mockReset();
  });

  const legalTransitions = [
    { from: 'open', to: 'in_progress' },
    { from: 'open', to: 'wontfix' },
    { from: 'in_progress', to: 'open' },
    { from: 'in_progress', to: 'fixed' },
    { from: 'fixed', to: 'open' },
    { from: 'wontfix', to: 'open' },
  ];

  legalTransitions.forEach(({ from, to }) => {
    it(`allows legal transition: ${from} -> ${to}`, async () => {
      const mockBug = { _id: 'bug1', project: 'proj1', status: to, __v: 2 };
      Bug.findOneAndUpdate.mockResolvedValue(mockBug);
      BugEvent.create.mockResolvedValue({});

      const result = await bugStateService.transition('bug1', to, 'user1', 1, from);
      expect(result).toBe(mockBug);
      expect(Bug.findOneAndUpdate).toHaveBeenCalledWith(
        { _id: 'bug1', __v: 1, status: from },
        { $set: { status: to }, $inc: { __v: 1 } },
        { new: true }
      );
      expect(BugEvent.create).toHaveBeenCalledWith({
        bug: 'bug1',
        project: 'proj1',
        type: 'status_changed',
        from,
        to,
        memberId: 'user1',
      });
    });
  });

  const allStatuses = ['open', 'in_progress', 'fixed', 'wontfix'];
  allStatuses.forEach((from) => {
    allStatuses.forEach((to) => {
      const isLegal = legalTransitions.some((t) => t.from === from && t.to === to);
      if (!isLegal) {
        it(`rejects illegal transition: ${from} -> ${to}`, async () => {
          await expect(
            bugStateService.transition('bug1', to, 'user1', 1, from)
          ).rejects.toThrow(new AppError(422, 'ILLEGAL_TRANSITION', 'Illegal status transition'));
          expect(Bug.findOneAndUpdate).not.toHaveBeenCalled();
        });
      }
    });
  });

  it('throws STALE_VERSION if findOneAndUpdate returns null', async () => {
    Bug.findOneAndUpdate.mockResolvedValue(null);
    await expect(
      bugStateService.transition('bug1', 'in_progress', 'user1', 1, 'open')
    ).rejects.toThrow(new AppError(409, 'STALE_VERSION', 'Conflict: stale version'));
  });
});
