const express = require('express');
const router = express.Router();
const projectController = require('../controllers/projectController');
const { protect, isProjectAdmin } = require('../middleware/authMiddleware');

router.post('/', protect, projectController.createProject);
router.get('/', protect, projectController.getProjects);
router.get('/:id', protect, projectController.getProjectById);
router.post('/:id/members', protect, isProjectAdmin, projectController.addMember);
router.put('/:id', protect, isProjectAdmin, projectController.updateProject);
router.delete('/:id', protect, isProjectAdmin, projectController.deleteProject);

module.exports = router;
