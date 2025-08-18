// FILE: backend/models/Requisition.js
const mongoose = require('mongoose');

const requisitionItemSchema = new mongoose.Schema({
    stockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockItem',
        required: true
    },
    description: { // Denormalized for easier display on the form
        type: String,
        required: true
    },
    quantityRequested: {
        type: Number,
        required: true,
        min: 1
    },
    quantityIssued: {
        type: Number,
        default: 0
    }
}, { _id: false });

const RequisitionSchema = new mongoose.Schema({
    risNumber: {
        type: String,
        required: true,
        unique: true,
    },
    requestingOffice: {
        type: String,
        required: true,
    },
    requestingUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    purpose: {
        type: String,
        required: true,
    },
    items: [requisitionItemSchema],
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Issued', 'Rejected', 'Cancelled'],
        default: 'Pending'
    },
    remarks: String,
    dateRequested: { type: Date, default: Date.now },
}, { timestamps: true });

module.exports = mongoose.model('Requisition', RequisitionSchema);