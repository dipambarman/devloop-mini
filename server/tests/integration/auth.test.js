import request from 'supertest';
import { app } from '../../index.js'; // I need to export app from index.js
import { clearCollections } from '../helpers/db.js';

describe('Auth routes', () => {
  beforeEach(async () => {
    await clearCollections();
  });

  const validUser = { email: 'test@example.com', password: 'password123' };

  it('signs up a new user', async () => {
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(201);
    expect(res.body.email).toBe(validUser.email);
    expect(res.body.id).toBeDefined();
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects duplicate email signup', async () => {
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app).post('/api/auth/signup').send(validUser);
    expect(res.status).toBe(409);
  });

  it('logs in an existing user', async () => {
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app).post('/api/auth/login').send(validUser);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('rejects login with wrong password', async () => {
    await request(app).post('/api/auth/signup').send(validUser);
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: validUser.email, password: 'wrong' });
    expect(res.status).toBe(401);
  });

  it('returns me data with valid cookie', async () => {
    const loginRes = await request(app).post('/api/auth/signup').send(validUser);
    const cookie = loginRes.headers['set-cookie'];
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(validUser.email);
  });

  it('rejects me without cookie', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('clears cookie on logout', async () => {
    const loginRes = await request(app).post('/api/auth/signup').send(validUser);
    const cookie = loginRes.headers['set-cookie'];
    const res = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/Max-Age=0|Expires=Thu, 01 Jan 1970/);
  });

  it('validates signup input', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'not-an-email', password: '123' });
    expect(res.status).toBe(400);
  });
});
