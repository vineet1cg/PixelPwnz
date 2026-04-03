const Event = require('../models/Event');
const Snapshot = require('../models/Snapshot');
const Dataset = require('../models/Dataset');

const detectChange = async (snapshot) => {
    // find the previous snapshot before this one for the same dataset
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
        
        await Event.create({
            dataset_id: snapshot.dataset_id,
            type: 'Spike',
            percentage_change: percentageChange,
            previous_value: previousValue,
            current_value: currentValue,
            timestamp: snapshot.timestamp,
            message: `Significant change of ${percentageChange.toFixed(2)}% detected in ${dataset ? dataset.name : 'Dataset'}`,
            severity: Math.abs(percentageChange) > 50 ? 'Critical' : 'High'
        });
    }
};

module.exports = { detectChange };
