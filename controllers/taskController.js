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

        const priorityData = await Task.aggregate([
            { $match: { user: userId } },
            { $group: { _id: '$priority', count: { $sum: 1 } } }
        ]);

        const recentTasks = await Task.find({ user: userId })
            .sort({ createdAt: -1 })
            .limit(10);

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
           model: 'qwen-qwq-32b',  // ← CHANGE THIS
            messages: [{
                role: 'system',
                content: `You are a task breakdown expert. Your job is to break down goals into specific, actionable tasks.

RULES:
1. Always return ONLY valid JSON - no explanations
2. Each task must have a clear, specific title
3. Include a short, actionable description
4. Assign priority based on importance: high (critical), medium (important), low (nice-to-have)
5. dueDays: estimate how many days from today this should be done

Format: [{"title":"Clear action title","description":"What to do exactly","priority":"high|medium|low","dueDays":number}]`
            }, {
                role: 'user',
                content: `Break down this goal into 4-6 specific, actionable tasks: "${goal}"`
            }],
            temperature: 0.6,
            max_tokens: 800,
        });

        const text = completion.choices[0].message.content;
        const clean = text.replace(/```json|```|`/g, '').trim();
        
        let suggestions;
        try {
            suggestions = JSON.parse(clean);
            if (!Array.isArray(suggestions)) {
                throw new Error('Expected array');
            }
        } catch (parseError) {
            console.warn('AI parse failed, using fallback:', parseError.message);
            suggestions = [
                { title: `Research and plan: ${goal}`, description: 'Gather all necessary information and create a plan', priority: 'high', dueDays: 1 },
                { title: 'Break down into subtasks', description: 'Create detailed subtasks for each major step', priority: 'high', dueDays: 2 },
                { title: 'Start executing priority items', description: 'Begin work on the most critical tasks first', priority: 'medium', dueDays: 3 },
                { title: 'Review and adjust progress', description: 'Check progress and adjust plan if needed', priority: 'low', dueDays: 5 },
            ];
        }

        const today = new Date();
        const tasks = suggestions.map(s => ({
            title: s.title || 'Untitled task',
            description: s.description || 'No description provided',
            priority: ['high', 'medium', 'low'].includes(s.priority) ? s.priority : 'medium',
            dueDate: new Date(today.getTime() + (s.dueDays || 3) * 24 * 60 * 60 * 1000),
        }));

        res.status(200).json({ tasks });
    } catch (error) {
        console.error('AI Suggest Error:', error);
        const fallbackTasks = [
            { title: `Plan: ${req.body.goal || 'Your goal'}`, description: 'Create a step-by-step plan', priority: 'high', dueDate: new Date(Date.now() + 86400000) },
            { title: 'Research and gather materials', description: 'Collect everything you need', priority: 'medium', dueDate: new Date(Date.now() + 172800000) },
            { title: 'Execute first milestone', description: 'Complete the most important part first', priority: 'high', dueDate: new Date(Date.now() + 259200000) },
            { title: 'Review and adjust', description: 'Check progress and make adjustments', priority: 'low', dueDate: new Date(Date.now() + 345600000) },
        ];
        res.status(200).json({ tasks: fallbackTasks });
    }
};

//@desc   AI Chat Assistant with task context
//@route   POST /api/tasks/ai-chat
//@access  Private
const aiChat = async (req, res) => {
    try {
        const { messages, taskSummary, currentQuestion } = req.body;

        const systemPrompt = `You are a helpful personal task management assistant.

## IMPORTANT CONTEXT:
- Today's Date: ${new Date().toLocaleDateString()}
- User's Tasks: ${taskSummary}

## YOUR RULES (FOLLOW STRICTLY):
1. If asked "what to do first" → recommend the HIGHEST PRIORITY task that's due soonest
2. If asked about overdue tasks → list them with urgency
3. If no tasks exist → suggest creating a simple starting task
4. Keep responses under 3 sentences
5. Be specific - reference actual task titles
6. If you don't know, say so clearly
7. NEVER say "I don't have enough information" - use the tasks provided

## EXAMPLES OF GOOD RESPONSES:
Q: "What should I focus on today?"
A: "Focus on 'Complete project report' first - it's high priority and due tomorrow. Then work on 'Review meeting notes'."

Q: "Do I have any overdue tasks?"
A: "Yes, 'Submit weekly report' is overdue by 2 days. Please complete it now."

Q: "What are my tasks?"
A: "You have 5 tasks: 2 high priority ('Project report', 'Client meeting'), 2 medium, and 1 low. 'Project report' is due tomorrow."

Q: "I have no tasks"
A: "You currently have no tasks. Try setting a goal like 'Learn Python' and I'll break it down for you!"

Now respond to the user's question using these rules.`;

        const lastUserMessage = messages && messages.length > 0 
            ? messages[messages.length - 1] 
            : { content: currentQuestion || 'Hello' };

        const completion = await groq.chat.completions.create({
    model: 'qwen-qwq-32b',  // ← CHANGE THIS ONE LINE
            messages: [
                {
                    role: 'system',
                    content: systemPrompt
                },
                ...(messages || []),
            ],
            temperature: 0.5,
            max_tokens: 400,
        });

        const reply = completion.choices[0].message.content;

        if (!reply || reply.length < 5 || reply.includes("I don't have enough information")) {
            console.warn('AI gave poor response, using fallback');
            const fallbackReply = generateFallbackReply(lastUserMessage.content, taskSummary);
            return res.status(200).json({ reply: fallbackReply });
        }

        res.status(200).json({ reply });
    } catch (error) {
        console.error('AI Chat Error:', error);
        const fallbackReply = generateFallbackReply(req.body.messages?.[req.body.messages.length - 1]?.content || 'Hello', req.body.taskSummary || '');
        res.status(200).json({ reply: fallbackReply });
    }
};

// Helper: Generate fallback responses when AI fails
function generateFallbackReply(question, taskSummary) {
    const lowerQ = question.toLowerCase();
    const taskList = taskSummary || '';
    
    const hasTasks = taskList && taskList.includes('•') && taskList.length > 20;
    
    if (!hasTasks) {
        return "You don't have any tasks yet. Try setting a goal like 'Learn Python in 2 weeks' and I'll break it down for you! 🚀";
    }
    
    if (lowerQ.includes('focus') || lowerQ.includes('first') || lowerQ.includes('priority')) {
        const lines = taskList.split('•').filter(l => l.trim());
        const highPriority = lines.find(l => l.includes('high'));
        if (highPriority) {
            const taskName = highPriority.split('-')[0]?.trim() || 'your high priority task';
            return `Focus on "${taskName}" first - it's your highest priority task and should be completed soon. ✅`;
        }
        return "Check your 'high priority' tasks first. They're the most important ones to complete. 💪";
    }
    
    if (lowerQ.includes('overdue') || lowerQ.includes('late')) {
        const lines = taskList.split('•').filter(l => l.trim());
        const overdue = lines.find(l => l.includes('overdue'));
        if (overdue) {
            const taskName = overdue.split('-')[0]?.trim() || 'your task';
            return `⚠️ "${taskName}" is overdue! Please complete it as soon as possible.`;
        }
        return "Good news! You don't have any overdue tasks. Keep up the great work! 🎉";
    }
    
    if (lowerQ.includes('task') || lowerQ.includes('have')) {
        const lines = taskList.split('•').filter(l => l.trim());
        const count = lines.length;
        return `You have ${count} task${count > 1 ? 's' : ''}. ${taskList.substring(0, 200)}...`;
    }
    
    return "I'm here to help! Try asking: 'What should I focus on?' or 'Show me my overdue tasks.' 😊";
}

// ✅ CORRECT - Only ONE module.exports block
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