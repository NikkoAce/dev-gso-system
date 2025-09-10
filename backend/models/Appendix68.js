const mongoose = require('mongoose');

const appendix68Schema = new mongoose.Schema({
    appendixNumber: { type: String, required: true, unique: true },
    date: { type: Date, default: Date.now },
    assets: [{
        _id: false, // Don't create a separate _id for subdocuments
        propertyNumber: String,
        description: String,
        quantity: { type: Number, default: 1 },
        unit: { type: String, default: 'unit' },
        receiptInfo: { type: String, default: '' } // For "Official Receipt No. & Date of Sale"
    }],
    user: { // User who generated the slip
        name: String,
        office: String
    },
}, { timestamps: true });

module.exports = mongoose.model('Appendix68', appendix68Schema);