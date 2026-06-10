const Task = require('../models/Task');

const create = async (taskData, io) => {
  const { title, description, status, priority, project, assignees } = taskData;

  if (!title) {
    const error = new Error('Task title is required');
    error.status = 400;
    throw error;
  }
  if (!project) {
    const error = new Error('Project ID is required for task creation');
    error.status = 400;
    throw error;
  }

  const task = await Task.create({
    title,
    description,
    status: status || 'todo',
    priority: priority || 'medium',
    project,
    assignees: assignees || [],
  });

  const populatedTask = await Task.findById(task._id).populate('assignees', 'username email');

  // Real-time socket broadcast to project room
  if (io) {
    io.to(project.toString()).emit('task_created', populatedTask);
  }

  return populatedTask;
};

const getTasksByProject = async (projectId) => {
  return await Task.find({ project: projectId }).populate('assignees', 'username email');
};

const update = async (taskId, updateData, io) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  // Update allowed fields
  const allowedUpdates = ['title', 'description', 'status', 'priority', 'assignees', 'order'];
  allowedUpdates.forEach((key) => {
    if (updateData[key] !== undefined) {
      task[key] = updateData[key];
    }
  });

  await task.save();
  const populatedTask = await Task.findById(taskId).populate('assignees', 'username email');

  // Real-time socket broadcast to project room
  if (io) {
    io.to(task.project.toString()).emit('task_updated', populatedTask);
  }

  return populatedTask;
};

const remove = async (taskId, io) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  const projectId = task.project.toString();
  await task.deleteOne();

  // Real-time socket broadcast to project room
  if (io) {
    io.to(projectId).emit('task_deleted', taskId);
  }

  return true;
};

module.exports = {
  create,
  getTasksByProject,
  update,
  remove,
};
