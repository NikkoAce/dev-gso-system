const mongoose = require('mongoose');

const historySchema = new mongoose.Schema({
    event: { type: String, required: true },
    details: { type: String, required: true },
    user: { type: String, required: true },
    date: { type: Date, default: Date.now }
});

const assetSchema = new mongoose.Schema({
    propertyNumber: { type: String, required: true, unique: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    acquisitionDate: { type: Date, required: true },
    acquisitionCost: { type: Number, required: true },
    fundSource: { type: String, required: true },
    status: { type: String, default: 'In Use' },
    usefulLife: { type: Number },
    salvageValue: { type: Number, default: 0 },
    impairmentLosses: { type: Number, default: 0 },
    condition: { type: String },
    remarks: { type: String },
    office: { type: String }, // Top-level office, maybe for fund source or initial assignment
    custodian: {
        name: { type: String },
        office: { type: String },
        designation: { type: String }
    },
    specifications: [{
        key: { type: String },
        value: { type: String }
    }],
    attachments: [{
        key: { type: String },
        title: { type: String },
        originalName: { type: String },
        mimeType: { type: String }
    }],
    history: [historySchema],
    repairHistory: [{
        date: { type: Date, required: true },
        natureOfRepair: { type: String, required: true },
        amount: { type: Number, required: true }
    }],
    assignedPAR: { type: String },
    assignedICS: { type: String },
    physicalCountDetails: {
        verified: { type: Boolean, default: false },
        verifiedBy: { type: String },
        verifiedAt: { type: Date }
    }
}, {
    timestamps: true
});

// --- History Logging Middleware ---
assetSchema.pre('save', async function (next) {
    // If not new and no paths were modified, it's likely just an array push (e.g., repairHistory).
    // The history for those events is handled manually in the controller.
    if (!this.isNew && this.modifiedPaths().length === 0) {
        return next();
    }

    const user = this._user || { name: 'System' };
    const eventType = this._historyEvent || (this.isNew ? 'Created' : 'Updated');

    const format = (value, field) => {
        if (value instanceof Date) return new Date(value).toLocaleDateString('en-CA');
        if (['acquisitionCost', 'salvageValue'].includes(field) && typeof value === 'number') {
            return new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(value);
        }
        if (value === null || value === undefined || value === '') return 'empty';
        return `"${value}"`;
    };

    if (this.isNew) {
        this.history.push({
            event: 'Created',
            details: `Asset created with Property Number ${this.propertyNumber}.`,
            user: user.name
        });
    } else {
        const original = await this.constructor.findById(this._id).lean();

        for (const path of this.modifiedPaths()) {
            const oldValue = original[path.split('.')[0]];
            const newValue = this[path.split('.')[0]];

            if (path === 'status') {
                let details = `Status changed from ${format(original.status, 'status')} to ${format(this.status, 'status')}.`;
                if (this.status === 'Missing' && original.status !== 'Missing') {
                    this.assignedPAR = null; this.assignedICS = null;
                    details += ' Slip assignment cleared. Custodian retained for accountability.';
                }
                this.history.push({ event: eventType, details, user: user.name });
            } else if (path === 'custodian.name') {
                this.history.push({ event: 'Transfer', details: `Custodian changed from ${format(original.custodian?.name)} to ${format(this.custodian?.name)}.`, user: user.name });
            } else if (['description', 'category', 'fundSource', 'acquisitionDate', 'acquisitionCost', 'usefulLife', 'salvageValue', 'condition', 'remarks', 'office'].includes(path)) {
                const fieldName = path.charAt(0).toUpperCase() + path.slice(1).replace(/([A-Z])/g, ' $1');
                this.history.push({
                    event: eventType,
                    details: `${fieldName} changed from ${format(oldValue, path)} to ${format(newValue, path)}.`,
                    user: user.name
                });
            }
        }
    }

    // Clean up temporary properties so they aren't saved to the DB
    this._user = undefined;
    this._historyEvent = undefined;
    next();
});


module.exports = mongoose.model('Asset', assetSchema);