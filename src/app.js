const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const initializeSockets = require('./sockets/socketHandler');
const redisClient = require('./config/redis');

const app = express();
const server = http.createServer(app);

connectDB();

app.use(cors({
  origin: process.env.CLIENT_URL,
  credentials: true,
}));

app.use(express.json());

const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

if (process.env.REDIS_URL) {
  const { createClient } = require('redis');
  const { createAdapter } = require('@socket.io/redis-adapter');

  const pubClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      tls: process.env.REDIS_URL.startsWith('rediss://'),
      rejectUnauthorized: false,
      reconnectStrategy: (retries) => {
        if (retries > 10) {
          return new Error('Redis connection failed');
        }
        return Math.min(retries * 200, 5000);
      }
    }
  });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.error('Redis Pub Client Error:', err.message));
  subClient.on('error', (err) => console.error('Redis Sub Client Error:', err.message));

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Upstash Redis Adapter successfully connected for Socket.IO horizontal scaling');
    })
    .catch((err) => {
      console.error('Upstash Redis Adapter failed to initialize, falling back to local Memory adapter:', err.message);
    });
} else {
  console.log('No REDIS_URL provided. Operating in-memory mode.');
}

app.set('io', io);

initializeSockets(io);

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

app.get('/api/redis-health', async (req, res) => {
  if (!redisClient) {
    return res.status(500).json({ success: false, message: 'Upstash Redis REST client not initialized. Check your environment variables.' });
  }
  try {
    let mode = 'Read/Write';
    try {
      await redisClient.set('health_check', 'ok', { ex: 30 });
    } catch (writeErr) {
      if (writeErr.message && writeErr.message.includes('NOPERM')) {
        mode = 'Read-Only';
      } else {
        throw writeErr;
      }
    }
    const value = await redisClient.get('health_check');
    res.status(200).json({
      success: true,
      message: 'Upstash Redis REST connection successful',
      accessMode: mode,
      value
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Upstash Redis REST error', error: err.message });
  }
});

app.use((err, req, res, next) => {
  console.error('Central Error Handler:', err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, message });
});

const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}


module.exports = app;
