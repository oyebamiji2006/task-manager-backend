const Task = require('../models/task');
const User = require('../models/user');
const bcrypt = require('bcryptjs');

// @desc    Get all users (Admin only)
// @route   GET /api/users
// @access  Private/Admin
const getUsers = async (req, res) => {
    try {
        const users = await User.find({ role: 'member'}).select('-password'); //Exclude password field
       
       //Add task count for each user
       const usersWithTaskCount = await Promise.all(users.map(async (user) => {
        const pendingTasks = await Task.countDocuments({ assignedTo: user._id, status: 'pending' });
        const inProgressTasks = await Task.countDocuments({ assignedTo: user._id, status: 'in-progress' });
        const completedTasks = await Task.countDocuments({ assignedTo: user._id, status: 'completed' });
        return {
            ...user._doc,  //Include all user fields except password
            pendingTasks,
            inProgressTasks,
            completedTasks
        };
       }));
       res.json(usersWithTaskCount);
    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

// @desc    Get user by ID (Admin only)
// @route   GET /api/users/:id
// @access  Private/Admin
const getUserById = async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }
        res.json(user);
    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

// @desc    Delete user by ID (Admin only)
// @route   DELETE /api/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        await user.deleteOne();
        res.json({ message: 'User deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

module.exports = { getUsers, getUserById, deleteUser };