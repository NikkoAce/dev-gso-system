const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const { errorHandler } = require('./middlewares/errorMiddleware');

dotenv.config();
connectDB();

const app = express();

app.use(cors()); 
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
const reportRoutes = require('./routes/reportRoutes');
app.use('/api/reports', reportRoutes);
const stockItemRoutes = require('./routes/stockItemRoutes');
app.use('/api/stock-items', stockItemRoutes);
const requisitionRoutes = require('./routes/requisitionRoutes');
app.use('/api/requisitions', requisitionRoutes);
const immovableAssetRoutes = require('./routes/immovableAssetRoutes');
app.use('/api/immovable-assets', immovableAssetRoutes);

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