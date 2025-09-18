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
    saiNumber: { // NEW: To store the Supplies Availability Inquiry number
        type: String,
        index: true,
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
        enum: ['For Availability Check', 'Pending', 'Approved', 'Issued', 'Received', 'Rejected', 'Cancelled'],
        default: 'For Availability Check'
    },
    remarks: String,
    dateRequested: { type: Date, default: Date.now },
    // NEW: Fields to track when the end-user receives the items
    receivedByUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    dateReceivedByEndUser: {
        type: Date
    }
}, { timestamps: true });

module.exports = mongoose.model('Requisition', RequisitionSchema);