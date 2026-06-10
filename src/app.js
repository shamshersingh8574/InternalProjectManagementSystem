const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const { createClient } = require('redis');
const { createAdapter } = require('@socket.io/redis-adapter');

// Load environment variables from backend directory parent (reloaded)
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const connectDB = require('./config/db');
const authRoutes = require('./routes/auth');
const projectRoutes = require('./routes/projects');
const taskRoutes = require('./routes/tasks');
const initializeSockets = require('./sockets/socketHandler');

const app = express();
const server = http.createServer(app);

// Connect to MongoDB
connectDB();

// CORS middleware setup
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3000',
  credentials: true,
}));

app.use(express.json());

// Socket.IO Setup
const io = socketIo(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:3000',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  },
});

// Configure Redis pub/sub socket adapter
if (process.env.REDIS_URL) {
  const pubClient = createClient({
    url: process.env.REDIS_URL,
    socket: {
      reconnectStrategy: (retries) => {
        if (retries > 3) {
          // Returning an Error will reject the connect() promise and stop reconnect attempts
          return new Error('Redis connection failed');
        }
        return Math.min(retries * 100, 3000);
      }
    }
  });
  const subClient = pubClient.duplicate();

  pubClient.on('error', (err) => console.log('Redis Pub Client Error:', err.message));
  subClient.on('error', (err) => console.log('Redis Sub Client Error:', err.message));

  Promise.all([pubClient.connect(), subClient.connect()])
    .then(() => {
      io.adapter(createAdapter(pubClient, subClient));
      console.log('Redis Adapter successfully connected for Socket.IO horizontal scaling');
    })
    .catch((err) => {
      console.error('Redis Adapter failed to initialize, falling back to local Memory adapter:', err.message);
    });
} else {
  console.log('No REDIS_URL provided. Operating in-memory mode.');
}

// Make io accessible in routing request contexts
app.set('io', io);

// Initialize WebSocket event listeners
initializeSockets(io);

// Mount API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', time: new Date() });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('Central Error Handler:', err.stack);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ success: false, message });
});

// Start Server Listeners
const PORT = process.env.PORT || 5000;
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

module.exports = app;
