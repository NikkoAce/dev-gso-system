const mongoose = require('mongoose');

const SpecificationSchema = new mongoose.Schema({
    key: { type: String, required: true },
    value: { type: String, required: true },
}, {_id: false});

const HistorySchema = new mongoose.Schema({
    date: {
        type: Date,
        default: Date.now
    },
    event: {
        type: String,
        required: true
    },
    details: { type: String, required: true },
    from: { type: String },
    to: { type: String },
    user: { type: String, required: true }
}, { _id: false });

const CustodianSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    designation: { type: String, trim: true },
    office: { type: String, required: true, trim: true }
}, {_id: false});


const AssetSchema = new mongoose.Schema({
  propertyNumber: { type: String, required: true, unique: true },
  description: { type: String, required: [true, 'Please add a description'] },
  specifications: [SpecificationSchema],
  category: { type: String, required: true },
  fundSource: { type: String, required: [true, 'Please specify the fund source'] },
  office: { type: String, required: [true, 'Please specify the office'] },
  custodian: { type: CustodianSchema, required: true },
  acquisitionDate: { type: Date, default: Date.now },
  acquisitionCost: { type: Number, required: [true, 'Please add an acquisition cost'] },
  usefulLife: { type: Number, required: [true, 'Please add the useful life in years'] },
  salvageValue: { type: Number, default: 0 },
  status: { type: String, enum: ['In Use', 'In Storage', 'For Repair', 'Disposed'], default: 'In Use' },
  assignedPAR: { type: String, default: null },
  assignedICS: { type: String, default: null }, // NEW
  maintenanceSchedule: { type: Date },
  condition: { type: String, trim: true },
  remarks: { type: String, trim: true },
  history: [HistorySchema]
}, { timestamps: true });

module.exports = mongoose.model('Asset', AssetSchema);
