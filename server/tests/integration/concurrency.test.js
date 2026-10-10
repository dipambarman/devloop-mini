import request from 'supertest';
import { app } from '../../index.js';
import { clearCollections } from '../helpers/db.js';
import Bug from '../../src/models/Bug.js';
import BugEvent from '../../src/models/BugEvent.js';

describe('Concurrency and Regression', () => {
  let cookieA, projectId;

  beforeEach(async () => {
    await clearCollections();
    const resA = await request(app).post('/api/auth/signup').send({ email: 'a@test.com', password: 'password123' });
    cookieA = resA.headers['set-cookie'];
    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'Proj' });
    projectId = pRes.body.id;
  });

  it('handles concurrent ingest correctly', async () => {
    const payload = { message: 'Concurrent bug', stack: 'at foo' };
    const requests = Array.from({ length: 20 }, () =>
      request(app).post(`/api/projects/${projectId}/ingest`).set('Cookie', cookieA).send(payload)
    );
    await Promise.all(requests);

    const bugs = await Bug.find();
    expect(bugs).toHaveLength(1);
    expect(bugs[0].occurrenceCount).toBe(20);

    const events = await BugEvent.find({ type: 'occurrence' });
    expect(events).toHaveLength(20);
  });

  it('detects and counts regressions properly', async () => {
    const payload = { message: 'Regressive bug', stack: 'at foo' };
    
    // 1. Initial ingest
    const iRes1 = await request(app).post(`/api/projects/${projectId}/ingest`).set('Cookie', cookieA).send(payload);
    const bugId = iRes1.body.id;

    // 2. Mark fixed
    const bug = await Bug.findById(bugId);
    await request(app)
      .post(`/api/bugs/${bugId}/status`)
      .set('Cookie', cookieA)
      .send({ status: 'fixed', version: bug.__v });

    const fixedBug = await Bug.findById(bugId);
    expect(fixedBug.status).toBe('fixed');

    // 3. Re-ingest
    const iRes2 = await request(app).post(`/api/projects/${projectId}/ingest`).set('Cookie', cookieA).send(payload);
    expect(iRes2.body.status).toBe('open');
    expect(iRes2.body.regressions).toBe(1);

    // 4. Verify event order (status_changed before occurrence)
    const events = await BugEvent.find({ bug: bugId }).sort({ createdAt: 1, _id: 1 });
    const lastStatusChanged = events.findLast((e) => e.type === 'status_changed');
    const lastOccurrence = events.findLast((e) => e.type === 'occurrence');

    expect(lastStatusChanged.createdAt.getTime()).toBeLessThan(lastOccurrence.createdAt.getTime());
  });
});
