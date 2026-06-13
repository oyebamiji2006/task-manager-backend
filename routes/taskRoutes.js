const express = require('express');
const { protect } = require('../middlewares/authMiddleware');
const { getDashboardData, 
    getTasks, 
    getTaskById, 
    createTask, 
    updateTask, 
    deleteTask, 
    updateTaskStatus, 
    updateTaskChecklist, 
    aiSuggestTasks, 
    aiChat } 
= require('../controllers/taskController');

const router = express.Router();

//Task Management Routes
router.get('/dashboard-data', protect, getDashboardData);
router.get('/', protect, getTasks);
router.get('/:id', protect, getTaskById);
router.post('/', protect, createTask);
router.post('/ai-suggest', protect, aiSuggestTasks);
router.put('/:id', protect, updateTask);
router.delete('/:id', protect, deleteTask);
router.put('/:id/status', protect, updateTaskStatus);
router.put('/:id/todo', protect, updateTaskChecklist);
router.post('/ai-chat', protect, aiChat);

module.exports = router;