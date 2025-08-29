const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    event: { type: String, required: true },
    details: { type: String, required: true },
    user: { type: String, required: true }
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
    key: { type: String, required: true },
    originalName: { type: String, required: true },
    title: { type: String, trim: true },
    mimeType: { type: String, required: true }
}, { _id: false });

const componentSchema = new mongoose.Schema({
    name: { type: String, required: true },
    description: { type: String }
}, { _id: false });

const repairHistorySchema = new mongoose.Schema({
    date: { type: Date, required: true },
    natureOfRepair: { type: String, required: true },
    amount: { type: Number, required: true }
}, { _id: false });

const landDetailsSchema = new mongoose.Schema({
    lotNumber: String,
    titleNumber: String,
    taxDeclarationNumber: String,
    areaSqm: Number,
    classification: String,
    boundaries: {
        north: String,
        south: String,
        east: String,
        west: String
    }
}, { _id: false });

const buildingAndStructureDetailsSchema = new mongoose.Schema({
    numberOfFloors: Number,
    floorArea: Number,
    constructionDate: Date,
    constructionMaterials: String,
    estimatedUsefulLife: Number,
    salvageValue: Number
}, { _id: false });

const roadNetworkDetailsSchema = new mongoose.Schema({
    lengthKm: Number,
    widthMeters: Number,
    pavementType: String
}, { _id: false });

const otherInfrastructureDetailsSchema = new mongoose.Schema({
    structureType: String,
    technicalSpecifications: String
}, { _id: false });

const immovableAssetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    propertyIndexNumber: { type: String, required: true, unique: true },
    type: { type: String, required: true, enum: ['Land', 'Building', 'Other Structures', 'Road Network', 'Other Public Infrastructure'] },
    location: { type: String, required: true },
    dateAcquired: { type: Date, required: true },
    assessedValue: { type: Number, required: true },
    status: { type: String, required: true, enum: ['In Use', 'Under Construction', 'Idle', 'For Disposal', 'Disposed'] },
    acquisitionMethod: { type: String, enum: ['Purchase', 'Donation', 'Construction', 'Expropriation', 'Other'] },
    condition: { type: String, enum: ['Good', 'Fair', 'Needs Major Repair', 'Condemned'] },
    remarks: String,
    
    // --- New Fields for Ledger Card ---
    fundSource: { type: String },
    accountCode: { type: String },
    impairmentLosses: { type: Number, default: 0 },
    repairHistory: [repairHistorySchema],
    // ------------------------------------
    latitude: { type: Number },
    longitude: { type: Number },

    // --- NEW: Parent-Child Linking ---
    parentAsset: { type: mongoose.Schema.Types.ObjectId, ref: 'ImmovableAsset', default: null },

    components: [componentSchema],
    attachments: [attachmentSchema],
    history: [historySchema],
    landDetails: landDetailsSchema,
    buildingAndStructureDetails: buildingAndStructureDetailsSchema,
    roadNetworkDetails: roadNetworkDetailsSchema,
    otherInfrastructureDetails: otherInfrastructureDetailsSchema
}, { timestamps: true });

module.exports = mongoose.model('ImmovableAsset', immovableAssetSchema);
