const mongoose = require('mongoose');

const ptrAssetSchema = new mongoose.Schema({
    propertyNumber: { type: String, required: true },
    description: { type: String, required: true },
    acquisitionCost: { type: Number, required: true },
    remarks: { type: String }
}, { _id: false });

const custodianInfoSchema = new mongoose.Schema({
    name: { type: String, required: true },
    designation: { type: String },
    office: { type: String }
}, { _id: false });

const ptrSchema = new mongoose.Schema({
    ptrNumber: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    slipType: {
        type: String,
        default: 'PTR',
        enum: ['PTR']
    },
    from: { type: custodianInfoSchema, required: true },
    to: { type: custodianInfoSchema, required: true },
    assets: [ptrAssetSchema],
    date: {
        type: Date,
        required: true
    },
    user: { type: String, required: true } // User who initiated the transfer
}, { timestamps: true });

module.exports = mongoose.model('PTR', ptrSchema);
