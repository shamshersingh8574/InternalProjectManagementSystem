const Task = require('../models/Task');
const Project = require('../models/Project');
const User = require('../models/User');

const create = async (taskData, io, actorId) => {
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

  const populatedTask = await Task.findById(task._id)
    .populate('assignees', 'username email')
    .populate('project', 'name')
    .populate('comments.user', 'username');

  // Real-time socket broadcast to project room
  if (io) {
    const projId = populatedTask.project._id.toString();
    io.to(projId).emit('task_created', populatedTask);

    // Notify other assignees in their personal room
    if (populatedTask.assignees && populatedTask.assignees.length > 0) {
      populatedTask.assignees.forEach((assignee) => {
        const assigneeIdStr = assignee._id.toString();
        if (actorId && assigneeIdStr === actorId.toString()) return; // skip self-notification
        io.to(`user_${assigneeIdStr}`).emit('task_assigned', {
          task: populatedTask,
          project: populatedTask.project,
        });
      });
    }
  }

  return populatedTask;
};

const getTasksByProject = async (projectId) => {
  return await Task.find({ project: projectId })
    .populate('assignees', 'username email')
    .populate('comments.user', 'username');
};

const update = async (taskId, updateData, io, actorId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  // Enforce RBAC
  const project = await Project.findById(task.project);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  const isOwner = project.owner.toString() === actorId.toString();
  if (!isOwner) {
    // Check if member
    const isMember = project.members.some(id => id.toString() === actorId.toString());
    if (!isMember) {
      const error = new Error('Access denied: You are not a member of this project');
      error.status = 403;
      throw error;
    }

    // Check if assignee
    const isAssignee = task.assignees.some(id => id.toString() === actorId.toString());
    if (!isAssignee) {
      const error = new Error('Access denied: You can only update tasks assigned to you');
      error.status = 403;
      throw error;
    }

    // Check what is actually being changed. Members can only change status.
    const allowedUpdates = ['title', 'description', 'status', 'priority', 'assignees', 'order'];
    const attemptedFields = Object.keys(updateData).filter(key => allowedUpdates.includes(key) && updateData[key] !== undefined);
    const changedFields = attemptedFields.filter((key) => {
      if (key === 'assignees') {
        const dbAssignees = task.assignees ? task.assignees.map(id => id.toString()).sort() : [];
        const updateAssignees = updateData.assignees ? updateData.assignees.map(id => id.toString()).sort() : [];
        return JSON.stringify(dbAssignees) !== JSON.stringify(updateAssignees);
      }
      const dbVal = task[key];
      const updateVal = updateData[key];
      const normDb = (dbVal === null || dbVal === undefined) ? '' : String(dbVal).trim();
      const normUpdate = (updateVal === null || updateVal === undefined) ? '' : String(updateVal).trim();
      return normDb !== normUpdate;
    });

    const forbiddenFields = changedFields.filter(key => key !== 'status');
    if (forbiddenFields.length > 0) {
      const error = new Error('Access denied: Members can only update the status of their assigned tasks');
      error.status = 403;
      throw error;
    }
  }

  // Get previous assignees to find newly added and removed assignees
  const oldAssigneeIds = task.assignees ? task.assignees.map(id => id.toString()) : [];

  if (updateData.assignees !== undefined) {
    const newAssigneeIds = updateData.assignees.map(id => id.toString());
    const removedAssigneeIds = oldAssigneeIds.filter(id => !newAssigneeIds.includes(id));
    
    if (removedAssigneeIds.length > 0) {
      const reasons = updateData.unassignReasons || {};
      for (const userId of removedAssigneeIds) {
        const reasonText = reasons[userId] || "No reason provided.";
        const removedUser = await User.findById(userId);
        const username = removedUser ? removedUser.username : 'User';
        
        // Post a comment indicating why the user was unassigned
        task.comments.push({
          user: actorId,
          text: `🔄 System: ${username} was unassigned from this task. Reason: "${reasonText}"`
        });
        
        // Emit a socket notification to that specific user's personal room
        if (io) {
          io.to(`user_${userId}`).emit('task_unassigned_notification', {
            taskId,
            taskTitle: task.title,
            projectName: project.name,
            reason: reasonText,
            message: `You have been unassigned from task "${task.title}" in project "${project.name}". Reason: "${reasonText}"`
          });
        }
      }
    }
  }

  // Update allowed fields
  const allowedUpdates = ['title', 'description', 'status', 'priority', 'assignees', 'order'];
  allowedUpdates.forEach((key) => {
    if (updateData[key] !== undefined) {
      task[key] = updateData[key];
    }
  });

  await task.save();
  const populatedTask = await Task.findById(taskId)
    .populate('assignees', 'username email')
    .populate('project', 'name')
    .populate('comments.user', 'username');

  // Real-time socket broadcast to project room
  if (io) {
    const projId = populatedTask.project._id.toString();
    io.to(projId).emit('task_updated', populatedTask);

    // Notify newly added assignees
    if (populatedTask.assignees && populatedTask.assignees.length > 0) {
      populatedTask.assignees.forEach((assignee) => {
        const assigneeIdStr = assignee._id.toString();
        // Skip self-notification
        if (actorId && assigneeIdStr === actorId.toString()) return;
        // If they were not in the old list of assignees, notify them!
        if (!oldAssigneeIds.includes(assigneeIdStr)) {
          io.to(`user_${assigneeIdStr}`).emit('task_assigned', {
            task: populatedTask,
            project: populatedTask.project,
          });
        }
      });
    }
  }

  return populatedTask;
};

const remove = async (taskId, io, actorId) => {
  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  const project = await Project.findById(task.project);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  if (project.owner.toString() !== actorId.toString()) {
    const error = new Error('Access denied: Only project owners can delete tasks');
    error.status = 403;
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

const addComment = async (taskId, commentData, io) => {
  const { text, user } = commentData;
  if (!text) {
    const error = new Error('Comment text is required');
    error.status = 400;
    throw error;
  }

  const task = await Task.findById(taskId);
  if (!task) {
    const error = new Error('Task not found');
    error.status = 404;
    throw error;
  }

  const project = await Project.findById(task.project);
  if (!project) {
    const error = new Error('Project not found');
    error.status = 404;
    throw error;
  }

  const isMember = project.members.some(id => id.toString() === user.toString());
  const isOwner = project.owner.toString() === user.toString();
  if (!isMember && !isOwner) {
    const error = new Error('Access denied: You must be a project member to comment');
    error.status = 403;
    throw error;
  }

  task.comments.push({ user, text });
  await task.save();

  const populatedTask = await Task.findById(taskId)
    .populate('assignees', 'username email')
    .populate('project', 'name')
    .populate('comments.user', 'username');

  if (io) {
    const projId = populatedTask.project._id.toString();
    io.to(projId).emit('task_updated', populatedTask);
  }

  return populatedTask;
};

module.exports = {
  create,
  getTasksByProject,
  update,
  remove,
  addComment,
};
