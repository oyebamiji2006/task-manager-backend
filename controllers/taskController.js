const Task = require('../models/task');
const Groq = require('groq-sdk');
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const getTasks = async (req, res) => {
    try {
        const { status } = req.query;
        let filter = { user: req.user._id };
        if (status) filter.status = status;
        let tasks = await Task.find(filter).sort({ dueDate: 1 });
        tasks = tasks.map((task) => {
            const completedCount = task.todoChecklist.filter(item => item.completed).length;
            return { ...task._doc, completedTodoCount: completedCount };
        });
        const allTasks = await Task.countDocuments({ user: req.user._id });
        const pendingTasks = await Task.countDocuments({ user: req.user._id, status: 'pending' });
        const inProgressTasks = await Task.countDocuments({ user: req.user._id, status: 'in-progress' });
        const completedTasks = await Task.countDocuments({ user: req.user._id, status: 'completed' });
        res.json({
            tasks,
            statusSummary: { all: allTasks, pending: pendingTasks, inProgress: inProgressTasks, completed: completedTasks }
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const getTaskById = async (req, res) => {
    try {
        const task = await Task.findOne({ _id: req.params.id, user: req.user._id });
        if (!task) return res.status(404).json({ message: 'Task not found' });
        res.json(task);
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

const createTask = async (req, res) => {
    try {
        const { title, description, priority, status, dueDate, scheduledTime, category, todoChecklist } = req.body;
        const task = await Task.create({
            title, description, priority, status, dueDate,
            scheduledTime, category, todoChecklist, user: req.user._id,
        });
        res.status(201).json({ message: 'Task created successfully', task });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

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

const getDashboardData = async (req, res) => {
    try {
        const userId = req.user._id;
        const totalTasks = await Task.countDocuments({ user: userId });
        const pendingTasks = await Task.countDocuments({ user: userId, status: 'pending' });
        const inProgressTasks = await Task.countDocuments({ user: userId, status: 'in-progress' });
        const completedTasks = await Task.countDocuments({ user: userId, status: 'completed' });
        const priorityData = await Task.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);
        const recentTasks = await Task.find({ user: userId }).sort({ createdAt: -1 }).limit(10);
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
            priorityData, recentTasks, upcomingTasks,
        });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// ── HELPER: detect total days from goal text ─────────────────────────────
const extractTotalDays = (goal) => {
    const text = goal.toLowerCase();
    const patterns = [
        { regex: /(\d+)\s*week/,   mult: 7 },
        { regex: /(\d+)\s*month/,  mult: 30 },
        { regex: /(\d+)\s*day/,    mult: 1 },
        { regex: /(\d+)\s*hour/,   mult: 1 },
    ];
    for (const p of patterns) {
        const m = text.match(p.regex);
        if (m) return parseInt(m[1]) * p.mult;
    }
    return 7; // default 7 days
};

// ── AI SUGGEST ─────────────────────────────────────────────────────────────
const aiSuggestTasks = async (req, res) => {
    try {
        const { goal } = req.body;
        if (!goal) return res.status(400).json({ message: 'Goal is required' });

        const totalDays = extractTotalDays(goal);
        // Scale task count: 1 week = 7 tasks, 2 weeks = 10 tasks, 1 month = 14 tasks
        const taskCount = Math.min(14, Math.max(5, Math.ceil(totalDays * 0.6)));

        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                {
                    role: 'system',
                    content: `You are a task breakdown assistant. Return ONLY a valid JSON array. No markdown, no explanation, no extra text whatsoever.
Array format: [{"title":"...","description":"...","priority":"high|medium|low","dueDay":number,"dueHour":number}]
Rules:
- Generate exactly ${taskCount} tasks spread across ${totalDays} days
- dueDay: which day (1 to ${totalDays}) this task should be completed
- dueHour: realistic hour for the task (8=morning, 12=noon, 15=afternoon, 18=evening, 21=night)
- Spread tasks evenly — don't put all tasks on day 1
- Make titles very specific to the goal, not generic
- First tasks should be high priority, later ones medium/low`
                },
                {
                    role: 'user',
                    content: `Goal: "${goal}" (${totalDays} days total)\nGenerate ${taskCount} specific tasks. Return only JSON array.`
                }
            ],
            temperature: 0.3,
            max_tokens: 1200,
        });

        let text = completion.choices[0].message.content || '';
        text = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
        text = text.replace(/```json|```/g, '').trim();

        const match = text.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('No JSON array in response');

        const suggestions = JSON.parse(match[0]);
        if (!Array.isArray(suggestions)) throw new Error('Expected array');

        const today = new Date();
        // Set time to midnight so dueDay calculations are clean
        today.setHours(0, 0, 0, 0);

        const tasks = suggestions.map(s => {
            const dueDay = Math.max(1, Math.min(s.dueDay || 1, totalDays));
            const dueHour = s.dueHour || 9;
            // Calculate due date: today + dueDay days, at the specified hour
            const dueDate = new Date(today);
            dueDate.setDate(today.getDate() + dueDay);
            dueDate.setHours(dueHour, 0, 0, 0);

            return {
                title: s.title || 'Task',
                description: s.description || '',
                priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
                dueDate,
            };
        });

        res.status(200).json({ tasks });
    } catch (error) {
        console.error('AI Suggest Error:', error.message);
        // Fallback with proper time distribution
        const goal = req.body.goal || 'your goal';
        const totalDays = extractTotalDays(req.body.goal || '');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const makeDate = (day, hour) => {
            const d = new Date(today);
            d.setDate(today.getDate() + day);
            d.setHours(hour, 0, 0, 0);
            return d;
        };
        res.status(200).json({
            tasks: [
                { title: `Research and plan: ${goal}`, description: 'Gather information and create a detailed plan', priority: 'high', dueDate: makeDate(1, 9) },
                { title: `Set up environment for: ${goal}`, description: 'Prepare tools, resources, and workspace needed', priority: 'high', dueDate: makeDate(Math.ceil(totalDays * 0.2), 10) },
                { title: `Complete first milestone: ${goal}`, description: 'Finish the first major step of your goal', priority: 'high', dueDate: makeDate(Math.ceil(totalDays * 0.4), 14) },
                { title: `Practice and review: ${goal}`, description: 'Practice what you have learned and review progress', priority: 'medium', dueDate: makeDate(Math.ceil(totalDays * 0.6), 15) },
                { title: `Complete second milestone: ${goal}`, description: 'Finish the second major step', priority: 'medium', dueDate: makeDate(Math.ceil(totalDays * 0.8), 16) },
                { title: `Final review and wrap up: ${goal}`, description: 'Review everything and confirm goal completion', priority: 'low', dueDate: makeDate(totalDays, 18) },
            ]
        });
    }
};

// ── AI CHAT (with ability to create tasks) ────────────────────────────────
const aiChat = async (req, res) => {
    try {
        const { messages } = req.body;
        const userId = req.user._id;

        const tasks = await Task.find({ user: userId }).sort({ dueDate: 1 });
        const now = new Date();

        let taskContext = '';
        if (tasks.length === 0) {
            taskContext = 'The user has no tasks yet.';
        } else {
            taskContext = tasks.map(t => {
                const due = t.dueDate ? new Date(t.dueDate) : null;
                const isOverdue = due && due < now && t.status !== 'completed';
                const dueStr = due ? due.toLocaleString() : 'no due date';
                return `- ID:${t._id} | "${t.title}" | priority:${t.priority} | status:${t.status} | due:${dueStr}${isOverdue ? ' ⚠️OVERDUE' : ''}`;
            }).join('\n');
        }

        const systemPrompt = `You are TaskFlow AI, a smart personal productivity assistant with the ability to CREATE tasks for the user.

Today: ${now.toLocaleString()}

USER'S CURRENT TASKS:
${taskContext}

YOUR CAPABILITIES:
1. Answer questions about their tasks
2. Give productivity advice
3. CREATE new tasks when the user asks you to

WHEN CREATING TASKS:
- If the user asks you to add, create, set, or schedule a task — respond with a JSON block at the END of your message
- Format: <TASKS>[{"title":"...","description":"...","priority":"high|medium|low","dueDays":number,"dueHour":number}]</TASKS>
- dueDays: days from today (0=today, 1=tomorrow, etc.)
- dueHour: 8=morning, 12=noon, 15=afternoon, 18=evening
- You can create multiple tasks in one go
- After the JSON block, confirm what you created in plain text

RULES:
- Be specific — use actual task titles in your answers
- Keep responses short (2-4 sentences) unless creating tasks
- If user asks what to focus on → recommend highest priority task due soonest
- Never say you don't have information — you have the full task list above
- Be friendly and encouraging`;

        const completion = await groq.chat.completions.create({
            model: 'openai/gpt-oss-20b',
            messages: [
                { role: 'system', content: systemPrompt },
                ...(messages || []),
            ],
            temperature: 0.4,
            max_tokens: 600,
        });

        let reply = completion.choices[0].message.content || '';
        reply = reply.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

        // Check if AI wants to create tasks
        const taskMatch = reply.match(/<TASKS>([\s\S]*?)<\/TASKS>/);
        let createdTasks = [];

        if (taskMatch) {
            try {
                const taskData = JSON.parse(taskMatch[1]);
                const today = new Date();
                today.setHours(0, 0, 0, 0);

                for (const t of taskData) {
                    const dueDate = new Date(today);
                    dueDate.setDate(today.getDate() + (t.dueDays || 0));
                    dueDate.setHours(t.dueHour || 9, 0, 0, 0);

                    const newTask = await Task.create({
                        title: t.title,
                        description: t.description || '',
                        priority: ['high', 'medium', 'low'].includes(t.priority) ? t.priority : 'medium',
                        status: 'pending',
                        dueDate,
                        category: 'General',
                        user: userId,
                    });
                    createdTasks.push(newTask);
                }
                // Remove the JSON block from the reply shown to user
                reply = reply.replace(/<TASKS>[\s\S]*?<\/TASKS>/g, '').trim();
            } catch (e) {
                console.error('Task creation from chat failed:', e.message);
            }
        }

        res.status(200).json({ reply, createdTasks });
    } catch (error) {
        console.error('AI Chat Error:', error.message);
        res.status(200).json({
            reply: "I'm having trouble connecting right now. Please try again in a moment.",
            createdTasks: []
        });
    }
};

module.exports = {
    getTasks, getTaskById, createTask, updateTask, deleteTask,
    updateTaskStatus, updateTaskChecklist, getDashboardData,
    aiSuggestTasks, aiChat,
};
