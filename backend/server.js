require('dotenv').config();
const http = require('http');
const { Server } = require("socket.io");
const { initSocket } = require('./config/socket');
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/errorMiddleware');

const app = express();

// Create the HTTP server from the Express app
const server = http.createServer(app);

// --- CONFIGURATION & MIDDLEWARE---

// Define the frontend URLs that are allowed to make requests to this backend.
const allowedOrigins = [
    'https://dev-gso-system.netlify.app',     // Your GSO Frontend
    'https://lgu-employee-portal.netlify.app', // Your Portal Frontend
    'http://127.0.0.1:5500',                   // Local dev for GSO
    'http://127.0.0.1:5501'                    // Local dev for Portal
];

// Initialize Socket.IO server and attach it to the HTTP server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ["GET", "POST", "OPTIONS"],
        credentials: true
    },
    transports: ['websocket', 'polling'] // Explicitly define transports for proxy compatibility
});

initSocket(io); // Initialize our custom socket logic

const corsOptions = {
    origin: allowedOrigins,
    methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
    credentials: true, // Allow cookies to be sent
    preflightContinue: false,
    optionsSuccessStatus: 204 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions)); // Use the secure CORS options
app.use(express.json());

// --- Sanity Check Route ---
app.get('/api/healthcheck', (req, res) => {
    console.log('Healthcheck endpoint was hit successfully!');
    res.status(200).json({ status: 'ok', message: 'GSO Backend is running.' });
});

// --- API Routes ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/pars', require('./routes/parRoutes'));
app.use('/api/ics', require('./routes/icsRoutes'));
app.use('/api/physical-count', require('./routes/physicalCountRoutes'));
app.use('/api/asset-transfers', require('./routes/assetTransferRoutes'));
app.use('/api/assets/batch', require('./routes/assetImportExportRoutes'));
app.use('/api/iirups', require('./routes/iirupRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/offices', require('./routes/officeRoutes'));
app.use('/api/slips', require('./routes/slipRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/stock-items', require('./routes/stockItemRoutes'));
app.use('/api/requisitions', require('./routes/requisitionRoutes'));
app.use('/api/immovable-assets', require('./routes/immovableAssetRoutes'));
app.use('/api/dashboard', require('./routes/dashboardRoutes'));
app.use('/api/appendix68', require('./routes/appendix68Routes'));
app.use('/api/admin', require('./routes/adminRoutes')); 
app.use('/api/receiving-reports', require('./routes/receivingReportRoutes'));


console.log('Registering /api/users routes...');
app.use('/api/roles', require('./routes/roleRoutes'));
// IMPORTANT: This line registers the new user management routes with the application.
app.use('/api/users', require('./routes/userRoutes'));
console.log('Successfully registered /api/users routes.');

// Add a 404 handler specifically for API routes
// This should be after all API routes and before the static file serving
app.use('/api/*', (req, res, next) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

// This must be the last middleware to catch all errors
app.use(errorHandler);

const PORT = process.env.PORT || 5001;

// Wrap server startup in an async function to handle DB connection first
const startServer = async () => {
  try {
    await connectDB();
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  } catch (error) {
    console.error("Server failed to start:", error);
    process.exit(1); // Exit if the DB connection fails on startup
  }
};

startServer();