require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/errorMiddleware');

connectDB();

const app = express();

// --- CONFIGURATION & MIDDLEWARE---

// Define the frontend URLs that are allowed to make requests to this backend.
const allowedOrigins = [
    'https://dev-gso-system.netlify.app',     // Your GSO Frontend
    'https://lgu-employee-portal.netlify.app', // Your Portal Frontend
    'http://127.0.0.1:5500',                   // Local dev for GSO
    'http://127.0.0.1:5501'                    // Local dev for Portal
];

const corsOptions = {
    origin: function (origin, callback) {
        // Allow requests with no origin (like mobile apps or Postman) and from whitelisted origins
        if (!origin || allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    }
};

app.use(cors(corsOptions)); // Use the secure CORS options
app.use(express.json());

// --- API Routes ---
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/assets', require('./routes/assetRoutes'));
app.use('/api/pars', require('./routes/parRoutes'));
app.use('/api/ics', require('./routes/icsRoutes'));
app.use('/api/categories', require('./routes/categoryRoutes'));
app.use('/api/offices', require('./routes/officeRoutes'));
app.use('/api/slips', require('./routes/slipRoutes'));
app.use('/api/employees', require('./routes/employeeRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/stock-items', require('./routes/stockItemRoutes'));
app.use('/api/requisitions', require('./routes/requisitionRoutes'));
app.use('/api/immovable-assets', require('./routes/immovableAssetRoutes'));

// Add a 404 handler specifically for API routes
// This should be after all API routes and before the static file serving
app.use('/api/*', (req, res, next) => {
    res.status(404).json({ message: `API route not found: ${req.method} ${req.originalUrl}` });
});

const frontendPath = path.join(__dirname, '..', 'frontend', 'public');
app.use(express.static(frontendPath));

app.get('*', (req, res) => {
    res.sendFile(path.resolve(frontendPath, 'index.html'));
});

// This must be the last middleware to catch all errors
app.use(errorHandler);

const PORT = process.env.PORT || 5001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));