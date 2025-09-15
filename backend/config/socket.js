const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;

/**
 * Initializes the Socket.IO server instance and sets up event handlers.
 * @param {import('socket.io').Server} socketIoInstance - The Socket.IO server instance.
 */
const initSocket = (socketIoInstance) => {
    io = socketIoInstance;

    // Middleware for authenticating socket connections using JWT
    io.use(async (socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication error: Token not provided'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            if (!decoded.user || !decoded.user.id) {
                return next(new Error('Authentication error: Invalid token payload'));
            }

            // Attach user to the socket object for use in event handlers
            socket.user = await User.findById(decoded.user.id).select('-password').lean();
            if (!socket.user) {
                return next(new Error('Authentication error: User not found'));
            }
            next();
        } catch (error) {
            next(new Error('Authentication error: Invalid token'));
        }
    });

    io.on('connection', (socket) => {
        console.log(`User connected: ${socket.user.name} (${socket.id})`);

        socket.on('join-room', (room) => {
            socket.join(room);
            console.log(`Socket ${socket.id} joined room: ${room}`);
        });

        socket.on('leave-room', (room) => {
            socket.leave(room);
            console.log(`Socket ${socket.id} left room: ${room}`);
        });

        socket.on('disconnect', () => {
            console.log(`User disconnected: ${socket.id}`);
        });
    });
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

module.exports = { initSocket, getIo };