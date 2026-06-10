const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Project = require('../models/Project');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id).select('-password');
      
      if (!req.user) {
        return res.status(401).json({ success: false, message: 'Not authorized, user not found' });
      }

      next();
    } catch (error) {
      console.error(error);
      return res.status(401).json({ success: false, message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

const isProjectMember = async (req, res, next) => {
  const projectId = req.params.projectId || req.body.project || req.body.projectId || req.query.project || req.params.id;

  if (!projectId) {
    return res.status(400).json({ success: false, message: 'Project ID is required for authorization' });
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    const isMember = project.members.some(
      (memberId) => memberId.toString() === req.user._id.toString()
    );
    const isOwner = project.owner.toString() === req.user._id.toString();

    if (!isMember && !isOwner) {
      return res.status(403).json({ success: false, message: 'Access denied: You are not a member of this project' });
    }

    req.project = project;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

const isProjectAdmin = async (req, res, next) => {
  const projectId = req.params.projectId || req.body.project || req.body.projectId || req.query.project || req.params.id;

  if (!projectId) {
    return res.status(400).json({ success: false, message: 'Project ID is required for authorization' });
  }

  try {
    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    if (project.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied: Only project owners/admins can perform this action' });
    }

    req.project = project;
    next();
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  protect,
  isProjectMember,
  isProjectAdmin,
};
