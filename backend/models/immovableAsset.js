const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    date: { type: Date, default: Date.now },
    event: { type: String, required: true }, // e.g., 'Created', 'Updated Assessed Value', 'Re-classified', 'Renovated'
    details: { type: String },
    user: { type: String, required: true } // Name of the user who made the change, or 'System'
});

const componentSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    description: { type: String, trim: true }
}, { _id: false });

const attachmentSchema = new mongoose.Schema({
    key: { type: String, required: true }, // The key/filename in the S3 bucket
    url: { type: String, required: true }, // The public URL to access the file
    title: { type: String, trim: true }, // User-defined title for the document
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true }
}, { _id: false });

const immovableAssetSchema = new mongoose.Schema({
    // --- Core Details ---
    name: {
        type: String,
        required: [true, 'Asset name is required.'],
        trim: true
    },
    propertyIndexNumber: { // Unique identifier (PIN)
        type: String,
        required: [true, 'Property Index Number is required.'],
        unique: true,
        trim: true
    },
    type: {
        type: String,
        required: true,
        enum: ['Land', 'Building', 'Other Structures', 'Road Network', 'Other Public Infrastructure'],
        default: 'Land'
    },
    location: {
        type: String,
        required: [true, 'Location or address is required.'],
        trim: true
    },
    dateAcquired: {
        type: Date,
        required: true
    },
    assessedValue: {
        type: Number,
        required: [true, 'Assessed value is required.'],
        default: 0
    },
    status: {
        type: String,
        required: true,
        enum: ['In Use', 'Under Construction', 'Idle', 'For Disposal', 'Disposed'],
        default: 'In Use'
    },
    acquisitionMethod: {
        type: String,
        enum: ['Purchase', 'Donation', 'Construction', 'Expropriation', 'Other'],
        default: 'Purchase'
    },
    condition: {
        type: String,
        enum: ['Good', 'Fair', 'Needs Major Repair', 'Condemned'],
        default: 'Good'
    },
    
    // --- Type-Specific Details (Optional Sub-documents) ---
    landDetails: {
        lotNumber: { type: String, trim: true },
        titleNumber: { type: String, trim: true }, // e.g., TCT, OCT
        taxDeclarationNumber: { type: String, trim: true },
        areaSqm: { type: Number }, // Area in Square Meters
        boundaries: {
            north: { type: String, trim: true },
            south: { type: String, trim: true },
            east: { type: String, trim: true },
            west: { type: String, trim: true }
        },
        classification: {
            type: String,
            enum: ['Residential', 'Commercial', 'Agricultural', 'Industrial', 'Institutional', 'Park/Open Space', 'Other'],
            trim: true
        }
    },
    buildingAndStructureDetails: {
        numberOfFloors: { type: Number },
        floorArea: { type: Number }, // Total floor area in SqM
        constructionDate: { type: Date },
        constructionMaterials: { type: String, trim: true }, // e.g., Concrete, Steel, Wood, Mixed
        estimatedUsefulLife: { type: Number }, // In years, for depreciation
        salvageValue: { type: Number, default: 0 }
    },
    roadNetworkDetails: {
        lengthKm: { type: Number },
        widthMeters: { type: Number },
        pavementType: { type: String, enum: ['Concrete', 'Asphalt', 'Gravel', 'Earth'], trim: true }
    },
    otherInfrastructureDetails: {
        structureType: { type: String, trim: true }, // e.g., Bridge, Water System, Canal
        technicalSpecifications: { type: String, trim: true } // e.g., Capacity, Dimensions
    },

    // --- General Fields ---
    remarks: {
        type: String,
        trim: true
    },
    components: [componentSchema],
    attachments: [attachmentSchema],
    history: [historySchema]
}, {
    timestamps: true // Adds createdAt and updatedAt fields
});

module.exports = mongoose.model('ImmovableAsset', immovableAssetSchema);
