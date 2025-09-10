const mongoose = require('mongoose');

const iirupAssetSchema = new mongoose.Schema({
    propertyNumber: { type: String, required: true },
    acquisitionDate: { type: Date },
    description: { type: String, required: true },
    acquisitionCost: { type: Number, required: true },
    remarks: { type: String } // To store the asset's condition at the time of inspection
}, { _id: false });

const iirupSchema = new mongoose.Schema({
    iirupNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    assets: [iirupAssetSchema],
    user: { // User who generated the slip
        name: String,
        office: String
    },
}, { timestamps: true });

module.exports = mongoose.model('IIRUP', iirupSchema);
