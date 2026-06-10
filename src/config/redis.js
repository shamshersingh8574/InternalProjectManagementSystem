const { Redis } = require('@upstash/redis');

let redisClient = null;

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('Upstash REST Redis client initialized successfully');
  } catch (err) {
    console.error('Failed to initialize Upstash REST Redis client:', err.message);
  }
} else {
  console.log('Upstash Redis REST credentials missing.');
}

module.exports = redisClient;
