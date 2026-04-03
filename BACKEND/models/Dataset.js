const mongoose = require('mongoose');

const datasetSchema = new mongoose.Schema({
    name: { type: String, required: true },
    category: { type: String, required: true, enum: ['crypto', 'weather', 'air_quality', 'forex'] },
    source_api: { type: String, required: true },
    location: { type: String, required: true },
    unit: { type: String, required: true },
    fetch_interval_minutes: { type: Number, default: 5 }
}, { timestamps: true });

module.exports = mongoose.model('Dataset', datasetSchema);
