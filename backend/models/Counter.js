const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
    _id: { type: String, required: true }, // This will be the property number prefix, e.g., "2024-101-401-01-"
    sequence_value: { type: Number, default: 0 }
});

module.exports = mongoose.model('Counter', counterSchema);