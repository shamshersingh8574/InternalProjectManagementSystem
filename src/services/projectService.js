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

const inviteMember = async (projectId, email, io) => {
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

  const populatedProject = await Project.findById(projectId).populate(
    'owner members',
    'username email'
  );

  // Real-time socket emissions
  if (io) {
    // Notify the invited user in their personal room
    io.to(`user_${user._id.toString()}`).emit('project_invited', populatedProject);
    // Broadcast project update to the project room so other members see the new member in real-time
    io.to(projectId.toString()).emit('project_updated', populatedProject);
  }

  return populatedProject;
};

const update = async (projectId, name, description, io) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  if (name !== undefined) project.name = name;
  if (description !== undefined) project.description = description;

  await project.save();
  const populatedProject = await Project.findById(projectId).populate(
    'owner members',
    'username email'
  );

  if (io) {
    // Broadcast project update to the project room so active board viewers see the new name
    io.to(projectId.toString()).emit('project_updated', populatedProject);

    // Broadcast project update to all members' personal rooms so dashboard cards update
    if (populatedProject.members) {
      populatedProject.members.forEach((member) => {
        io.to(`user_${member._id.toString()}`).emit('project_updated', populatedProject);
      });
    }
  }

  return populatedProject;
};

const remove = async (projectId, io) => {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  // Cascade delete tasks in this project
  const Task = require('../models/Task');
  await Task.deleteMany({ project: projectId });

  // Get members list to notify them before deleting
  const memberIds = project.members ? project.members.map(id => id.toString()) : [];

  // Delete the project
  await project.deleteOne();

  if (io) {
    // Notify users inside the workspace board room
    io.to(projectId.toString()).emit('project_deleted', projectId);

    // Notify all members on their dashboard to remove the project card
    memberIds.forEach((memberId) => {
      io.to(`user_${memberId}`).emit('project_deleted', projectId);
    });
  }

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
