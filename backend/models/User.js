const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    externalId: { // This will store the employeeId from the Portal system
        type: String,
        required: true,
        unique: true,
    },
    name: {
        type: String,
        required: true,
    },
    office: {
        type: String,
        required: true,
    },
    role: { // This links to the GSO-specific Role model
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true,
    }
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);