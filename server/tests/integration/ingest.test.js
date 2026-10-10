import request from 'supertest';
import { app } from '../../index.js';
import { clearCollections } from '../helpers/db.js';
import Bug from '../../src/models/Bug.js';
import BugEvent from '../../src/models/BugEvent.js';

describe('Ingest route', () => {
  let cookieA, projectId;

  beforeEach(async () => {
    await clearCollections();
    const resA = await request(app).post('/api/auth/signup').send({ email: 'a@test.com', password: 'password123' });
    cookieA = resA.headers['set-cookie'];
    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'Proj' });
    projectId = pRes.body.id;
  });

  it('ingests an error', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ingest`)
      .set('Cookie', cookieA)
      .send({ message: 'TypeError: null', stack: 'at foo' });
    expect(res.status).toBe(200);
    expect(res.body.occurrenceCount).toBe(1);
    expect(res.body.status).toBe('open');

    const bugs = await Bug.find();
    expect(bugs).toHaveLength(1);
    
    const events = await BugEvent.find();
    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('occurrence');
  });

  it('deduplicates identical errors', async () => {
    const payload = { message: 'TypeError: null', stack: 'at foo' };
    await request(app).post(`/api/projects/${projectId}/ingest`).set('Cookie', cookieA).send(payload);
    const res = await request(app).post(`/api/projects/${projectId}/ingest`).set('Cookie', cookieA).send(payload);
    
    expect(res.status).toBe(200);
    expect(res.body.occurrenceCount).toBe(2);

    const bugs = await Bug.find();
    expect(bugs).toHaveLength(1); // Merged

    const events = await BugEvent.find();
    expect(events).toHaveLength(2);
  });
});
