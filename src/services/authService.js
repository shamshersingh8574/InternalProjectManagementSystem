const jwt = require('jsonwebtoken');
const User = require('../models/User');

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: '30d',
  });
};

const registerUser = async ({ username, email, password }) => {
  if (!username || !email || !password) {
    const error = new Error('Please enter all fields');
    error.status = 400;
    throw error;
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    const error = new Error('Please enter a valid email address');
    error.status = 400;
    throw error;
  }

  const emailExists = await User.findOne({ email });
  if (emailExists) {
    const error = new Error('Email already exists');
    error.status = 400;
    throw error;
  }

  const usernameExists = await User.findOne({ username });
  if (usernameExists) {
    const error = new Error('Username already exists');
    error.status = 400;
    throw error;
  }

  const user = await User.create({
    username,
    email,
    password,
  });

  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    token: generateToken(user._id),
  };
};

const loginUser = async ({ email, password }) => {
  if (!email || !password) {
    const error = new Error('Please enter all fields');
    error.status = 400;
    throw error;
  }

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.matchPassword(password))) {
    const error = new Error('Invalid email or password');
    error.status = 401;
    throw error;
  }

  return {
    _id: user._id,
    username: user.username,
    email: user.email,
    token: generateToken(user._id),
  };
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId);
  if (!user) {
    const error = new Error('User not found');
    error.status = 404;
    throw error;
  }
  return user;
};

const getUsersList = async () => {
  return await User.find({}).select('username email');
};

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  getUsersList,
};
