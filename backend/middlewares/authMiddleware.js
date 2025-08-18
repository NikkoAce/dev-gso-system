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

const gso = (req, res, next) => {
    // This middleware assumes the `protect` middleware has already run
    // and attached the user object to the request.
    if (req.user && req.user.office === 'GSO') {
        next();
    } else {
        res.status(403).json({ message: 'Not authorized. GSO access required.' });
    }
};

module.exports = { protect, gso };