const jwt = require('jsonwebtoken');
const User = require('../models/user');

//Middleware to protect routes
const protect = async (req, res, next) => {
    try {
 let token= req.headers.authorization;
 if(token && token.startsWith('Bearer ')){
   token = token.split(' ')[1]; //Extract token from header
   const decoded = jwt.verify(token, process.env.JWT_SECRET); //Verify token
   req.user = await User.findById(decoded.id).select('-password');
    next(); //Proceed to next middleware or route handler
 } else {
    res.status(401).json({message: 'Not authorized, no token'});
 }
    } catch (err) {
        res.status(401).json({message: 'Token failed', error: err.message});
    }
};

//Middleware for Admin-only access (not implemented yet, but can be added later)
const adminOnly = (req, res, next) => {
    if(req.user && req.user.role === 'admin'){
        next(); 
    } else {
        res.status(403).json({message: 'Access denied. Admin access only'});
    }
};
module.exports = { protect, adminOnly };