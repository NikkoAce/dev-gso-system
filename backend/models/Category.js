const mongoose = require('mongoose');

const CategorySchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true, trim: true },
    accountGroup: { type: String, trim: true },
    majorAccountGroup: { type: String, trim: true },
    subMajorGroup: { type: String, required: true, trim: true },
    glAccount: { type: String, required: true, trim: true }
}, { timestamps: true });

module.exports = mongoose.model('Category', CategorySchema);