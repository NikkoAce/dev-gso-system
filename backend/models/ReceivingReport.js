const mongoose = require('mongoose');

const receivingReportItemSchema = new mongoose.Schema({
    stockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockItem',
        required: true
    },
    description: { // Denormalized for easier display on reports
        type: String,
        required: true
    },
    quantityReceived: {
        type: Number,
        required: true,
        min: 1
    },
    unitCost: {
        type: Number,
        required: true,
        min: 0
    }
});

const receivingReportSchema = new mongoose.Schema({
    reportNumber: {
        type: String,
        required: true,
        unique: true
    },
    dateReceived: {
        type: Date,
        required: true,
        default: Date.now
    },
    supplier: {
        type: String,
        required: true
    },
    items: [receivingReportItemSchema],
    remarks: {
        type: String
    },
    receivedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ReceivingReport', receivingReportSchema);