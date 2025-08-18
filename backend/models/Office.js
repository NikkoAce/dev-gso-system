const mongoose = require('mongoose');

const OfficeSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
        trim: true
    },
    code: {
        type: String,
        required: true,
        unique: true,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('Office', OfficeSchema);