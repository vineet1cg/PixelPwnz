const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true },
    source_api: { type: String, required: true },
    location: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Dataset', datasetSchema);
