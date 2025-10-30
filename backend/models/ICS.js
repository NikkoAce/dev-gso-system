const mongoose = require('mongoose');

const CustodianSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    office: { type: String, required: true, trim: true }
}, {_id: false});

const ICSSchema = new mongoose.Schema({
    icsNumber: { type: String, required: true, unique: true },
    custodian: { type: CustodianSchema, required: true },
    assets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
    }],
    issuedDate: { type: Date, required: true },
    receivedDate: { type: Date, required: true },
    status: {
        type: String,
        enum: ['Active', 'Cancelled'],
        default: 'Active'
    }
}, { timestamps: true });

module.exports = mongoose.model('ICS', ICSSchema);
