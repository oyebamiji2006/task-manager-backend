const mongoose = require('mongoose');

const TaskSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        description: { type: String },
        priority: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
        status: { type: String, enum: ['pending', 'in-progress', 'completed'], default: 'pending' },
        dueDate: { type: Date },
        scheduledTime: { type: String }, // e.g. "09:00 AM"
        category: { type: String, default: 'General' },
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner
        todoChecklist: [{
            text: { type: String },
            completed: { type: Boolean, default: false }
        }],
        progress: { type: Number, default: 0 },
    },
    { timestamps: true }
);

module.exports = mongoose.model('Task', TaskSchema);