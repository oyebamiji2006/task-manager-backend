const User = require('../models/user');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

//Generate JWT Token
const generateToken = (userId) => {
    return jwt.sign({id: userId}, process.env.JWT_SECRET, {expiresIn: '30d'});
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
    try {
        const {name, email, password, profileImageURL, adminInviteToken} = req.body;

        //Check if user already exists
        const userExists = await User.findOne({email});

        if (userExists) {
            return res.status(400).json({message: 'User already exists'});
        }

        //Determine role based on admin invite token (if provided)
        let role = 'member';
        if (adminInviteToken && adminInviteToken === process.env.ADMIN_INVITE_TOKEN) {
            role = 'admin';
        }

        //Hash password
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        //Create user
        const user = await User.create({
            name,
            email,
            password: hashedPassword,
            profileImageURL,
            role
        });

        //Return User data and JWT token
        res.status(201).json({
            _id: user._id,
            name: user.name,
            email: user.email,
            role: user.role,
            profileImageURL: user.profileImageURL,
            token: generateToken(user._id)
        });

    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

// @desc    Login User
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(401).json({ message: 'Invalid email or password' });
        } 
//Compare Password
const isMatch = await bcrypt.compare(password, user.password);
if (!isMatch) { 
    return res.status(401).json({ message: 'Invalid email or password' });
}   

//Return User data and JWT token
res.json({
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    profileImageURL: user.profileImageURL,
    token: generateToken(user._id)
});
    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

// @desc    Get user profile
// @route   GET /api/auth/profile
// @access  Private
const getUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
       if (!user) {
        return res.status(404).json({message: 'User not found'});
       }
        res.json(user);
    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

// @desc    Update user profile
// @route   PUT /api/auth/profile
// @access  Private
const updateUserProfile = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({message: 'User not found'});
        }
        // Update user fields
        user.name = req.body.name || user.name;
        user.email = req.body.email || user.email;
        
if (req.body.password) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
}
        // Save updated user
        const updatedUser = await user.save();

        // Return updated user data
        res.json({
            _id: updatedUser._id,
            name: updatedUser.name,
            email: updatedUser.email,
            role: updatedUser.role,
            token: generateToken(updatedUser._id)
        });
    } catch (error) {
        res.status(500).json({message: 'Server error', error: error.message});
    }
};

module.exports = {
    registerUser,
    loginUser,
    getUserProfile,
    updateUserProfile
};