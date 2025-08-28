const mongoose = require('mongoose');

const gsoUserSchema = new mongoose.Schema({
    externalId: { // This will store the _id from the LGU Portal's user record
        type: String,
        required: true,
        unique: true,
        index: true,
    },
    name: { type: String, required: true },
    office: { type: String, required: true },
    role: { // The role within the GSO system (e.g., 'GSO Admin', 'Employee')
        type: String,
        required: true,
    },
    permissions: [{ // An array of permission strings
        type: String,
    }],
    dashboardPreferences: {
        cardOrder: { type: [String], default: [] },
        chartOrder: { type: [String], default: [] },
        tableOrder: { type: [String], default: [] },
        visibleComponents: { type: [String], default: [] }
    }
}, { timestamps: true });

module.exports = mongoose.model('User', gsoUserSchema);