const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
    dataset_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Dataset', required: true },
    type: { type: String, required: true, enum: ['spike', 'drop', 'anomaly', 'prediction'] },
    percentage_change: { type: Number, required: true },
    previous_value: { type: Number, required: true },
    current_value: { type: Number, required: true },
    timestamp: { type: Date, required: true, default: Date.now },
    message: { type: String, required: true },
    severity: { type: String, required: true, enum: ['low', 'medium', 'high'] },
    // AI-generated insights for significant changes
    is_significant: { type: Boolean, default: false },
    ai_reason: { type: String, default: null },
    ai_action: { type: String, default: null },
    ai_impact: { type: String, default: null },
    ai_confidence: { type: Number, min: 0, max: 100, default: null },
    target_timestamp: { type: Date, default: null },
    flagged_by: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    flagged_count: { type: Number, default: 0 },
    flag_notes: [{
        user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        text: String
    }]
});

eventSchema.index({ dataset_id: 1, timestamp: -1 });
eventSchema.index({ timestamp: -1 });
eventSchema.index({ is_significant: 1 });
eventSchema.index({ flagged_by: 1 });

module.exports = mongoose.model('Event', eventSchema);
