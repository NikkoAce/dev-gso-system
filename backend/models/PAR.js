const mongoose = require('mongoose');

// Define the same custodian schema here to ensure consistency
const CustodianSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    office: { type: String, required: true, trim: true }
}, {_id: false});

const PARSchema = new mongoose.Schema({
    parNumber: { type: String, required: true, unique: true },
    custodian: { type: CustodianSchema, required: true }, // FIX: Changed from String to CustodianSchema
    assets: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Asset'
    }],
    issuedDate: { type: Date, required: true },
    receivedDate: { type: Date, required: true },
}, { timestamps: true });

module.exports = mongoose.model('PAR', PARSchema);