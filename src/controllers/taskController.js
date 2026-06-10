const taskService = require('../services/taskService');

const createTask = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const task = await taskService.create(req.body, io, req.user._id);
    res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

const getProjectTasks = async (req, res, next) => {
  try {
    const tasks = await taskService.getTasksByProject(req.params.projectId);
    res.status(200).json({ success: true, tasks });
  } catch (error) {
    next(error);
  }
};

const updateTask = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const task = await taskService.update(req.params.id, req.body, io, req.user._id);
    res.status(200).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

const deleteTask = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    await taskService.remove(req.params.id, io, req.user._id);
    res.status(200).json({ success: true, message: 'Task deleted successfully' });
  } catch (error) {
    next(error);
  }
};

const addComment = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    const { text } = req.body;
    const task = await taskService.addComment(req.params.id, { text, user: req.user._id }, io);
    res.status(201).json({ success: true, task });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createTask,
  getProjectTasks,
  updateTask,
  deleteTask,
  addComment,
};
