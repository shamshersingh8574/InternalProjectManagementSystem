const express = require('express');
const router = express.Router();
const taskController = require('../controllers/taskController');
const { protect, isProjectMember, isProjectAdmin } = require('../middleware/authMiddleware');

router.post('/', protect, isProjectAdmin, taskController.createTask);
router.get('/project/:projectId', protect, isProjectMember, taskController.getProjectTasks);
router.put('/:id', protect, taskController.updateTask);
router.delete('/:id', protect, taskController.deleteTask);
router.post('/:id/comments', protect, taskController.addComment);

module.exports = router;
