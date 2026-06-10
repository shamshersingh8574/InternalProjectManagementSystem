const request = require('supertest');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const app = require('../src/app'); // Import app (without server.listen to prevent address-in-use)
const User = require('../src/models/User');

// Use a separate database for testing
const TEST_MONGO_URI = 'mongodb://127.0.0.1:27017/project_mgmt_test';

beforeAll(async () => {
  // If mongoose is already connected, disconnect it first
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(TEST_MONGO_URI);
});

afterAll(async () => {
  // Clean up collection and close connection
  await User.deleteMany({});
  await mongoose.disconnect();
});

beforeEach(async () => {
  await User.deleteMany({});
});

describe('POST /api/auth/register & POST /api/auth/login', () => {
  const testUser = {
    username: 'testuser',
    email: 'testuser@example.com',
    password: 'password123',
  };

  test('✅ Correct credentials → JWT token received', async () => {
    // 1. Register the user first
    const regRes = await request(app)
      .post('/api/auth/register')
      .send(testUser);
    expect(regRes.status).toBe(201);
    expect(regRes.body.success).toBe(true);
    expect(regRes.body.token).toBeDefined();

    // 2. Login with correct credentials
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: testUser.password,
      });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.success).toBe(true);
    expect(loginRes.body.token).toBeDefined();
    expect(loginRes.body.username).toBe(testUser.username);
  });

  test('✅ Wrong password → Returns 401 Error', async () => {
    // 1. Register the user
    await request(app)
      .post('/api/auth/register')
      .send(testUser);

    // 2. Login with incorrect password
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'wrongpassword',
      });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.message).toBe('Invalid email or password');
  });

  test('✅ Wrong email → Returns 401 Error', async () => {
    // Login with an email that is not registered
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'nonexistent@example.com',
        password: testUser.password,
      });

    expect(loginRes.status).toBe(401);
    expect(loginRes.body.success).toBe(false);
    expect(loginRes.body.message).toBe('Invalid email or password');
  });

  test('✅ JWT expiry check → Returns 401 on expired token', async () => {
    // Create an expired token manually using process.env.JWT_SECRET
    const expiredToken = jwt.sign(
      { id: new mongoose.Types.ObjectId().toString() },
      process.env.JWT_SECRET || 'supersecretkey123456!',
      { expiresIn: '-1s' } // Expired token
    );

    // Try to access a protected endpoint using the expired token
    const res = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toContain('Not authorized');
  });
});
