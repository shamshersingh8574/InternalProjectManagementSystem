const projectService = require('../services/projectService');

const createProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const project = await projectService.create(name, description, req.user._id);
    res.status(201).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const getProjects = async (req, res, next) => {
  try {
    const projects = await projectService.getAllForUser(req.user._id);
    res.status(200).json({ success: true, projects });
  } catch (error) {
    next(error);
  }
};

const getProjectById = async (req, res, next) => {
  try {
    const project = await projectService.getById(req.params.id);
    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const addMember = async (req, res, next) => {
  try {
    const { email } = req.body;
    const io = req.app.get('io');
    const project = await projectService.inviteMember(req.params.id, email, io);
    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const updateProject = async (req, res, next) => {
  try {
    const { name, description } = req.body;
    const io = req.app.get('io');
    const project = await projectService.update(req.params.id, name, description, io);
    res.status(200).json({ success: true, project });
  } catch (error) {
    next(error);
  }
};

const deleteProject = async (req, res, next) => {
  try {
    const io = req.app.get('io');
    await projectService.remove(req.params.id, io);
    res.status(200).json({ success: true, message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createProject,
  getProjects,
  getProjectById,
  addMember,
  updateProject,
  deleteProject,
};
