const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    type: { type: String, required: true, enum: ['spike', 'drop', 'anomaly'] },
    percentage_change: { type: Number, required: true },
    previous_value: { type: Number, required: true },
    current_value: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] }
});

eventSchema.index({ dataset_id: 1, timestamp: -1 });
eventSchema.index({ timestamp: -1 });

module.exports = mongoose.model('Event', eventSchema);
