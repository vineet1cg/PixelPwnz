const Event = require('../models/Event');
const Snapshot = require('../models/Snapshot');
const Dataset = require('../models/Dataset');

const detectChange = async (snapshot) => {
    // Find the previous snapshot before this one for the same dataset
    const previousSnapshot = await Snapshot.findOne({
        dataset_id: snapshot.dataset_id,
        timestamp: { $lt: snapshot.timestamp }
    }).sort({ timestamp: -1 });

    if (!previousSnapshot) return; // No previous snapshot to compare

    const previousValue = previousSnapshot.value;
    const currentValue = snapshot.value;

    if (previousValue === 0) return; // Avoid division by zero

    const percentageChange = ((currentValue - previousValue) / previousValue) * 100;

    if (Math.abs(percentageChange) > 15) {
        const dataset = await Dataset.findById(snapshot.dataset_id);
        const datasetName = dataset ? dataset.name : 'Dataset';

        // PRD: spike if positive, drop if negative
        const type = percentageChange > 0 ? 'spike' : 'drop';

        // PRD: 15-25% = medium, >=25% = high
        const severity = Math.abs(percentageChange) >= 25 ? 'high' : 'medium';

        // PRD: descriptive commit message
        const direction = percentageChange > 0 ? 'spiked' : 'dropped';
        const message = `${datasetName} ${direction} ${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}% from ${previousValue.toFixed(2)} to ${currentValue.toFixed(2)}`;

        await Event.create({
            dataset_id: snapshot.dataset_id,
            type,
            percentage_change: percentageChange,
            previous_value: previousValue,
            current_value: currentValue,
            timestamp: snapshot.timestamp,
            message,
            severity
        });
    }
};

module.exports = { detectChange };
