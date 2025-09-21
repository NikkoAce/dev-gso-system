const jwt = require('jsonwebtoken');
const User = require('../models/User');

let io;
// NEW: A map to track which user is in which room.
// Key: socket.id, Value: { user: { name, office }, room: 'office:...' }
const connectedUsers = new Map();

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

        socket.on('join-room', (roomName) => {
            const previousRoom = connectedUsers.get(socket.id)?.room;

            // If the user was in a different room, make them leave it first.
            if (previousRoom && previousRoom !== roomName) {
                socket.leave(previousRoom);
                // Notify others in the old room that this user has left.
                socket.to(previousRoom).emit('user-left', { name: socket.user.name, id: socket.id });
                console.log(`Socket ${socket.id} left room: ${previousRoom}`);
            }

            // Join the new room.
            socket.join(roomName);
            // Track the user's current room.
            connectedUsers.set(socket.id, { user: socket.user, room: roomName });
            console.log(`Socket ${socket.id} joined room: ${roomName}`);

            // Notify others in the new room that this user has joined.
            socket.to(roomName).emit('user-joined', { name: socket.user.name, id: socket.id });
        });

        socket.on('leave-room', (room) => {
            socket.leave(room);
            // Also update our tracking map
            const userInfo = connectedUsers.get(socket.id);
            if (userInfo && userInfo.room === room) {
                socket.to(userInfo.room).emit('user-left', { name: socket.user.name, id: socket.id });
                connectedUsers.delete(socket.id);
            }
            console.log(`Socket ${socket.id} left room: ${room}`);
        });

        socket.on('disconnect', () => {
            const userInfo = connectedUsers.get(socket.id);
            if (userInfo && userInfo.room) {
                // Notify others in the room that this user has left.
                socket.to(userInfo.room).emit('user-left', { name: socket.user.name, id: socket.id });
                // Clean up the tracking map.
                connectedUsers.delete(socket.id);
            }
            console.log(`User disconnected: ${socket.user.name} (${socket.id})`);
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