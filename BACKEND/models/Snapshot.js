const mongoose = require('mongoose');

const snapshotSchema = new mongoose.Schema({
    dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    value: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    metadata: { type: mongoose.Schema.Types.Mixed }
});

snapshotSchema.index({ dataset_id: 1, timestamp: -1 });
snapshotSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Snapshot', snapshotSchema);
