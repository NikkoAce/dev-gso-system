// FILE: backend/models/StockItem.js
const mongoose = require('mongoose');

const StockItemSchema = new mongoose.Schema({
    stockNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    unitOfMeasure: {
        type: String,
        required: true,
        trim: true,
    },
    quantity: {
        type: Number,
        required: true,
        default: 0,
    },
    reorderPoint: {
        type: Number,
        default: 0,
    },
    category: { type: String, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('StockItem', StockItemSchema);