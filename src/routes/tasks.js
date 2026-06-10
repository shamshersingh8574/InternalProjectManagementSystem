const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, isProjectMember } = require('../middleware/authMiddleware');

router.post('/', protect, isProjectMember, taskController.createTask);
router.get('/project/:projectId', protect, isProjectMember, taskController.getProjectTasks);
router.put('/:id', protect, taskController.updateTask);
router.delete('/:id', protect, taskController.deleteTask);

module.exports = router;
