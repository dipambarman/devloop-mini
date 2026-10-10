import request from 'supertest';
import { app } from '../../index.js';
import { clearCollections } from '../helpers/db.js';

describe('Project routes', () => {
  let cookieA, cookieB, userBId;

  beforeEach(async () => {
    await clearCollections();
    
    const resA = await request(app).post('/api/auth/signup').send({ email: 'a@test.com', password: 'password123' });
    cookieA = resA.headers['set-cookie'];

    const resB = await request(app).post('/api/auth/signup').send({ email: 'b@test.com', password: 'password123' });
    cookieB = resB.headers['set-cookie'];
    userBId = resB.body.id;
  });

  it('creates and lists projects', async () => {
    const createRes = await request(app)
      .post('/api/projects')
      .set('Cookie', cookieA)
      .send({ name: 'Project A' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.name).toBe('Project A');

    const listRes = await request(app).get('/api/projects').set('Cookie', cookieA);
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(1);
    expect(listRes.body[0].name).toBe('Project A');
  });

  it('adds a member to a project', async () => {
    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'P' });
    const addRes = await request(app)
      .post(`/api/projects/${pRes.body.id}/members`)
      .set('Cookie', cookieA)
      .send({ email: 'b@test.com' });
    
    expect(addRes.status).toBe(200);
    expect(addRes.body.id).toBe(userBId);

    const listResB = await request(app).get('/api/projects').set('Cookie', cookieB);
    expect(listResB.status).toBe(200);
    expect(listResB.body).toHaveLength(1);
  });

  it('rejects adding non-existent user', async () => {
    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'P' });
    const res = await request(app)
      .post(`/api/projects/${pRes.body.id}/members`)
      .set('Cookie', cookieA)
      .send({ email: 'nope@test.com' });
    expect(res.status).toBe(404);
  });

  it('rejects adding member as non-owner', async () => {
    const pRes = await request(app).post('/api/projects').set('Cookie', cookieA).send({ name: 'P' });
    const res = await request(app)
      .post(`/api/projects/${pRes.body.id}/members`)
      .set('Cookie', cookieB) // User B is not the owner
      .send({ email: 'a@test.com' });
    expect(res.status).toBe(404);
  });
});
