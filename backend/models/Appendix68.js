const mongoose = require('mongoose');

const inspectionCertificateSchema = new mongoose.Schema({
    isDestroyed: { type: Boolean, default: false },
    isSoldPrivate: { type: Boolean, default: false },
    isSoldPublic: { type: Boolean, default: false },
    isTransferred: { type: Boolean, default: false },
    transferredTo: { type: String, trim: true }
}, { _id: false });

const appendix68Schema = new mongoose.Schema({
    appendixNumber: { type: String, required: true, unique: true },
    placeOfStorage: { type: String },
    date: { type: Date, default: Date.now },
    assets: [{
        _id: false, // Don't create a separate _id for subdocuments
        propertyNumber: String,
        description: String,
        quantity: { type: Number, default: 1 },
        unit: { type: String, default: 'unit' },
        receiptInfo: { type: String, default: '' } // For "Official Receipt No. & Date of Sale"
    }],
    user: { // User who generated the slip (Supply and/or Property Custodian)
        name: String,
        office: String
    },
    // New fields for signatories and inspection details
    disposalApprovedBy: { type: String, trim: true },
    certifiedByInspector: { type: String, trim: true },
    witnessToDisposal: { type: String, trim: true },
    inspectionCertificate: inspectionCertificateSchema
}, { timestamps: true });

module.exports = mongoose.model('Appendix68', appendix68Schema);