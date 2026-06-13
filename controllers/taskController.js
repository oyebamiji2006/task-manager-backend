const Task = require('../models/task');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

//@desc   Get all tasks for logged-in user
//@route   GET /api/tasks/
//@access  Private
const getTasks = async (req, res) => {
    try {
        const { status } = req.query;
        let filter = { user: req.user._id };
        if (status) filter.status = status;

        let tasks = await Task.find(filter).sort({ dueDate: 1 });

        // Add completed todoChecklist count to each task
        tasks = tasks.map((task) => {
            const completedCount = task.todoChecklist.filter(item => item.completed).length;
            return { ...task._doc, completedTodoCount: completedCount };
        });

        // Status summary counts
        const allTasks = await Task.countDocuments({ user: req.user._id });
        const pendingTasks = await Task.countDocuments({ user: req.user._id, status: 'pending' });
        const inProgressTasks = await Task.countDocuments({ user: req.user._id, status: 'in-progress' });
        const completedTasks = await Task.countDocuments({ user: req.user._id, status: 'completed' });

        res.json({
            tasks,
            statusSummary: {
                all: allTasks,
                pending: pendingTasks,
                inProgress: inProgressTasks,
                completed: completedTasks,
            }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Get Task by ID
//@route   GET /api/tasks/:id
//@access  Private
const getTaskById = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Create a new task
//@route   POST /api/tasks/
//@access  Private
const createTask = async (req, res) => {
    try {
        const { title, description, priority, status, dueDate, scheduledTime, category, todoChecklist } = req.body;

        const task = await Task.create({
            title,
            description,
            priority,
            status,
            dueDate,
            scheduledTime,
            category,
            todoChecklist,
            user: req.user._id,
        });

        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Update Task
//@route   PUT /api/tasks/:id
//@access  Private
const updateTask = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.title = req.body.title || task.title;
        task.description = req.body.description || task.description;
        task.priority = req.body.priority || task.priority;
        task.status = req.body.status || task.status;
        task.dueDate = req.body.dueDate || task.dueDate;
        task.scheduledTime = req.body.scheduledTime || task.scheduledTime;
        task.category = req.body.category || task.category;
        task.todoChecklist = req.body.todoChecklist || task.todoChecklist;

        const updatedTask = await task.save();
        res.json({ message: 'Task updated successfully', task: updatedTask });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Delete a task
//@route   DELETE /api/tasks/:id
//@access  Private
const deleteTask = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        await task.deleteOne();
        res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Update Task status
//@route   PUT /api/tasks/:id/status
//@access  Private
const updateTaskStatus = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.status = req.body.status || task.status;

        if (task.status === 'completed') {
            task.todoChecklist.forEach((item) => (item.completed = true));
            task.progress = 100;
        }

        await task.save();
        res.status(200).json({ message: 'Task status updated', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Update Task checklist
//@route   PUT /api/tasks/:id/todo
//@access  Private
const updateTaskChecklist = async (req, res) => {
    try {
        const { todoChecklist } = req.body;
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.todoChecklist = todoChecklist;

        const completedCount = task.todoChecklist.filter(item => item.completed).length;
        const totalItems = task.todoChecklist.length;
        task.progress = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

        if (task.progress === 100) task.status = 'completed';
        else if (task.progress > 0) task.status = 'in-progress';
        else task.status = 'pending';

        await task.save();
        res.status(200).json({ message: 'Task checklist updated', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   Dashboard Data for logged-in user
//@route   GET /api/tasks/dashboard-data
//@access  Private
const getDashboardData = async (req, res) => {
    try {
        const userId = req.user._id;

        const totalTasks = await Task.countDocuments({ user: userId });
        const pendingTasks = await Task.countDocuments({ user: userId, status: 'pending' });
        const inProgressTasks = await Task.countDocuments({ user: userId, status: 'in-progress' });
        const completedTasks = await Task.countDocuments({ user: userId, status: 'completed' });

        // Priority breakdown
        const priorityData = await Task.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);

        // Recent 10 tasks
        const recentTasks = await Task.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(10);

        // Upcoming tasks (due in next 7 days)
        const today = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(today.getDate() + 7);
        const upcomingTasks = await Task.find({
            user: userId,
            dueDate: { $gte: today, $lte: nextWeek },
            status: { $ne: 'completed' }
        }).sort({ dueDate: 1 });

        res.status(200).json({
            totalTasks,
            statusSummary: { pending: pendingTasks, inProgress: inProgressTasks, completed: completedTasks },
            priorityData,
            recentTasks,
            upcomingTasks,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

//@desc   AI Suggest tasks from a goal
//@route   POST /api/tasks/ai-suggest
//@access  Private
const aiSuggestTasks = async (req, res) => {
    try {
        const { goal } = req.body;
        if (!goal) return res.status(400).json({ message: 'Goal is required' });

        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [{
                role: 'user',
                content: `Break down this goal into 3-5 actionable tasks with priorities and suggested due dates (from today). Return ONLY a JSON array, no explanation. Format:
[{"title":"...","description":"...","priority":"low|medium|high","dueDays":1}]
Goal: ${goal}`
            }],
            max_tokens: 1024,
        });

        const text = completion.choices[0].message.content;
        const clean = text.replace(/```json|```/g, '').trim();
        const suggestions = JSON.parse(clean);

        const today = new Date();
        const tasks = suggestions.map(s => ({
            ...s,
            dueDate: new Date(today.getTime() + s.dueDays * 24 * 60 * 60 * 1000),
        }));

        res.status(200).json({ tasks });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const aiChat = async (req, res) => {
    try {
        const { messages, taskSummary } = req.body;
        const completion = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: [
                {
                    role: 'system',
                    content: `You are a helpful personal task management assistant. The user's current tasks are:\n${taskSummary}\n\nHelp them manage their time, suggest priorities, break down goals, and give productivity advice. Be concise and friendly.`
                },
                ...messages
            ],
            max_tokens: 1024,
        });
        const reply = completion.choices[0].message.content;
        res.status(200).json({ reply });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = {
    getTasks,
    getTaskById,
    createTask,
    updateTask,
    deleteTask,
    updateTaskStatus,
    updateTaskChecklist,
    getDashboardData,
    aiSuggestTasks,
    aiChat,
};