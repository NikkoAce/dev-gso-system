// FILE: backend/middleware/authMiddleware.js
const jwt = require('jsonwebtoken');
const asyncHandler = require('express-async-handler');

const protect = asyncHandler(async (req, res, next) => {
    let token;

    if (!req.headers.authorization || !req.headers.authorization.startsWith('Bearer')) {
        res.status(401);
        throw new Error('Not authorized, no token');
    }

    try {
        // Get token from header
        token = req.headers.authorization.split(' ')[1];

        // Verify token
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Attach user to the request object (without the password)
        // The payload from your other server seems to be nested under `user`
        req.user = decoded.user;

        next();
    } catch (error) {
        console.error(error);
        res.status(401);
        throw new Error('Not authorized, token failed');
    }
});

const admin = (req, res, next) => {
    if (req.user && req.user.role === 'GSO Admin') {
        next();
    } else {
        res.status(403);
        throw new Error('Forbidden: Not authorized as an admin.');
    }
};

/**
 * Middleware factory to check for a specific permission.
 * @param {string} requiredPermission - The permission string to check for (e.g., 'asset:create').
 */
const checkPermission = (requiredPermission) => {
    return (req, res, next) => {
        // The `protect` middleware should have already run and populated req.user
        // with a payload that includes a `permissions` array.
        if (req.user && req.user.permissions && req.user.permissions.includes(requiredPermission)) {
            next();
        } else {
            res.status(403).json({ message: 'Forbidden: You do not have the required permission.' });
        }
    };
};

module.exports = { protect, checkPermission, admin };