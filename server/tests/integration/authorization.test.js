import request from 'supertest';
import { app } from '../../index.js';
import { clearCollections } from '../helpers/db.js';

describe('Authorization boundaries', () => {
  let cookieA, cookieB, projectId, bugId;

  beforeEach(async () => {
    await clearCollections();
    const resA = await request(app).post('/api/auth/signup').send({ email: 'a@test.com', password: 'password123' });
    cookieA = resA.headers['set-cookie'];

    const resB = await request(app).post('/api/auth/signup').send({ email: 'b@test.com', password: 'password123' });
    cookieB = resB.headers['set-cookie'];

    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'Proj' });
    projectId = pRes.body.id;

    const iRes = await request(app)
      .post(`/api/projects/${projectId}/ingest`)
      .set('Cookie', cookieA)
      .send({ message: 'Bug 1', stack: 'at foo' });
    bugId = iRes.body.id;
  });

  it('prevents non-member from accessing project ingest', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/ingest`)
      .set('Cookie', cookieB)
      .send({ message: 'X', stack: 'Y' });
    expect(res.status).toBe(404);
  });

  it('prevents non-member from accessing bug list', async () => {
    const res = await request(app).get(`/api/projects/${projectId}/bugs`).set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });

  it('prevents non-member from accessing bug details', async () => {
    const res = await request(app).get(`/api/bugs/${bugId}`).set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });

  it('prevents non-member from patching bug metadata', async () => {
    const res = await request(app).patch(`/api/bugs/${bugId}`).set('Cookie', cookieB).send({ severity: 'high' });
    expect(res.status).toBe(404);
  });

  it('prevents non-member from transitioning bug status', async () => {
    const res = await request(app)
      .post(`/api/bugs/${bugId}/status`)
      .set('Cookie', cookieB)
      .send({ status: 'in_progress', version: 0 });
    expect(res.status).toBe(404);
  });
});
