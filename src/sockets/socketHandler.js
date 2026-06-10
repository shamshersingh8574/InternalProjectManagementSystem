const jwt = require('jsonwebtoken');
const User = require('../models/User');

const initializeSockets = (io) => {
  // Socket.IO Authentication Middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['x-auth-token'];
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }
      socket.user = user;
      next();
    } catch (err) {
      return next(new Error('Authentication error: Invalid Token'));
    }
  });

  // Socket.IO Events Registration
  io.on('connection', (socket) => {
    const userRoom = `user_${socket.user._id.toString()}`;
    socket.join(userRoom);
    console.log(`User connected to Socket.IO: ${socket.user.username} (ID: ${socket.id}, Room: ${userRoom})`);

    // Join project room
    socket.on('join_project', (projectId) => {
      socket.join(projectId);
      console.log(`User ${socket.user.username} joined project room: ${projectId}`);
    });

    // Leave project room
    socket.on('leave_project', (projectId) => {
      socket.leave(projectId);
      console.log(`User ${socket.user.username} left project room: ${projectId}`);
    });

    // Handle user action state (e.g. typing activity)
    socket.on('user_action', (data) => {
      const { projectId, action, taskId } = data;
      socket.to(projectId).emit('user_action', {
        user: { _id: socket.user._id, username: socket.user.username },
        action,
        taskId
      });
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected from Socket.IO: ${socket.user.username}`);
    });
  });
};

module.exports = initializeSockets;
