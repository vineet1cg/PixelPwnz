require('dotenv').config();
const mongoose = require('mongoose');
const Dataset = require('./models/Dataset');
const Snapshot = require('./models/Snapshot');
const Event = require('./models/Event');
const connectDB = require('./config/db');

const seedData = async () => {
    await connectDB();
    
    // Clear existing data
    await Dataset.deleteMany();
    await Snapshot.deleteMany();
    await Event.deleteMany();

    const dataset = await Dataset.create({
        name: 'Bitcoin Price',
        category: 'Finance',
        source_api: 'CoinGecko',
        location: 'Global'
    });

    const datasetId = dataset._id;
    let currentValue = 50000;

    for (let i = 0; i < 48; i++) {
        const timestamp = new Date(Date.now() - (48 - i) * 5 * 60000); // 5 min intervals
        let changePercent = (Math.random() * 5) - 2.5; // +/- 2.5%
        
        // Induce a >15% spike randomly
        if (Math.random() > 0.8) {
            changePercent = 16 * (Math.random() > 0.5 ? 1 : -1);
        }

        const previousValue = currentValue;
        currentValue = currentValue * (1 + changePercent / 100);

        const snapshot = await Snapshot.create({
            dataset_id: datasetId,
            value: currentValue,
            timestamp: timestamp
        });

        if (Math.abs(changePercent) > 15) {
            await Event.create({
                dataset_id: datasetId,
                type: 'Spike',
                percentage_change: changePercent,
                previous_value: previousValue,
                current_value: currentValue,
                timestamp: timestamp,
                message: `Significant change of ${changePercent.toFixed(2)}% detected in Bitcoin Price`,
                severity: 'High'
            });
        }
    }

    console.log('Database Seeded Successfully!');
    process.exit();
};

seedData().catch(err => {
    console.error(err);
    process.exit(1);
});
