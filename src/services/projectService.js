const Project = require('../models/Project');
const User = require('../models/User');

const create = async (name, description, ownerId) => {
  if (!name) {
    const error = new Error('Project name is required');
    error.status = 400;
    throw error;
  }

  const project = await Project.create({
    name,
    description,
    owner: ownerId,
    members: [ownerId],
  });

  return project;
};

const getAllForUser = async (userId) => {
  return await Project.find({
    $or: [{ owner: userId }, { members: userId }],
  }).populate('owner members', 'username email');
};

const getById = async (projectId) => {
  const project = await Project.findById(projectId).populate(
    'owner members',
    'username email'
  );
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }
  return project;
};

const inviteMember = async (projectId, email) => {
  if (!email) {
    const error = new Error('Email is required to invite a member');
    error.status = 400;
    throw error;
  }

  const user = await User.findOne({ email });
  if (!user) {
    const error = new Error('User not found with this email');
    error.status = 404;
    throw error;
  }

  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  const isMember = project.members.some(
    (memberId) => memberId.toString() === user._id.toString()
  );
  if (isMember) {
    const error = new Error('User is already a project member');
    error.status = 400;
    throw error;
  }

  project.members.push(user._id);
  await project.save();

  return await Project.findById(projectId).populate(
    'owner members',
    'username email'
  );
};

const update = async (projectId, name, description) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;

  await project.save();
  return await Project.findById(projectId).populate(
    'owner members',
    'username email'
  );
};

const remove = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  // Cascade delete tasks in this project
  const Task = require('../models/Task');
  await Task.deleteMany({ project: projectId });

  // Delete the project
  await project.deleteOne();
  return true;
};

module.exports = {
  create,
  getAllForUser,
  getById,
  inviteMember,
  update,
  remove,
};
