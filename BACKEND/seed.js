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

    console.log('Cleared existing data...');

    // ── Create 3 datasets as per PRD ──
    const bitcoinDataset = await Dataset.create({
        name: 'bitcoin',
        category: 'crypto',
        source_api: 'coingecko',
        location: 'global',
        unit: 'USD',
        fetch_interval_minutes: 5
    });

    const delhiDataset = await Dataset.create({
        name: 'pm25-delhi',
        category: 'air_quality',
        source_api: 'openaq',
        location: 'Delhi, India',
        unit: 'μg/m³',
        fetch_interval_minutes: 5
    });

    const mumbaiDataset = await Dataset.create({
        name: 'mumbai-temp',
        category: 'weather',
        source_api: 'openweather',
        location: 'Mumbai, India',
        unit: '°C',
        fetch_interval_minutes: 5
    });

    console.log('Created 3 datasets...');

    // ── Helper: generate snapshots + events ──
    const generateSnapshots = async (dataset, baseValue, minVal, maxVal, spikeIndex, spikeValue, spikeMessage) => {
        let currentValue = baseValue;
        const snapshots = [];

        for (let i = 0; i < 48; i++) {
            const timestamp = new Date(Date.now() - (48 - i) * 60 * 60 * 1000); // 1-hour intervals, 48 hours

            if (i === spikeIndex) {
                // PRD: dramatic spike/drop event
                const previousValue = currentValue;
                currentValue = spikeValue;
                const percentageChange = ((currentValue - previousValue) / previousValue) * 100;

                const snapshot = await Snapshot.create({
                    dataset_id: dataset._id,
                    value: currentValue,
                    timestamp
                });
                snapshots.push(snapshot);

                const type = percentageChange > 0 ? 'spike' : 'drop';
                const severity = Math.abs(percentageChange) >= 25 ? 'high' : 'medium';

                await Event.create({
                    dataset_id: dataset._id,
                    type,
                    percentage_change: percentageChange,
                    previous_value: previousValue,
                    current_value: currentValue,
                    timestamp,
                    message: spikeMessage,
                    severity
                });

                console.log(`  Event created: ${spikeMessage}`);
            } else if (i === spikeIndex + 10 && dataset.name === 'pm25-delhi') {
                // Second spike for Delhi — stubble burning scenario
                const previousValue = currentValue;
                currentValue = 260;
                const percentageChange = ((currentValue - previousValue) / previousValue) * 100;

                const snapshot = await Snapshot.create({
                    dataset_id: dataset._id,
                    value: currentValue,
                    timestamp
                });
                snapshots.push(snapshot);

                if (Math.abs(percentageChange) > 15) {
                    const type = percentageChange > 0 ? 'spike' : 'drop';
                    const severity = Math.abs(percentageChange) >= 25 ? 'high' : 'medium';

                    await Event.create({
                        dataset_id: dataset._id,
                        type,
                        percentage_change: percentageChange,
                        previous_value: previousValue,
                        current_value: currentValue,
                        timestamp,
                        message: `Delhi PM2.5 spiked +${percentageChange.toFixed(1)}% — possible stubble burning event`,
                        severity
                    });
                    console.log(`  Event created: Delhi PM2.5 stubble burning spike`);
                }
            } else {
                // Normal fluctuation within realistic range
                const fluctuation = (Math.random() - 0.5) * (maxVal - minVal) * 0.08;
                currentValue = Math.max(minVal, Math.min(maxVal, currentValue + fluctuation));

                const snapshot = await Snapshot.create({
                    dataset_id: dataset._id,
                    value: currentValue,
                    timestamp
                });
                snapshots.push(snapshot);
            }
        }

        return snapshots;
    };

    // ── Bitcoin: $83,000–$88,000, one ~18% drop ──
    console.log('\nSeeding Bitcoin...');
    await generateSnapshots(
        bitcoinDataset,
        85000,       // base value
        83000,       // min range
        88000,       // max range
        20,          // spike at snapshot index 20
        69700,       // ~18% drop from ~85000
        'Bitcoin dropped -18.0% from $85,000.00 to $69,700.00 — major market sell-off'
    );

    // ── Delhi PM2.5: 80–180 μg/m³, spike above 200 ──
    console.log('Seeding Delhi PM2.5...');
    await generateSnapshots(
        delhiDataset,
        120,         // base value
        80,          // min range
        180,         // max range
        15,          // spike at snapshot index 15
        220,         // spike above 200
        'Delhi PM2.5 spiked +83.3% from 120.00 to 220.00 — hazardous air quality alert'
    );

    // ── Mumbai Temperature: 28–36°C, spike to 42°C ──
    console.log('Seeding Mumbai Temperature...');
    await generateSnapshots(
        mumbaiDataset,
        32,          // base value 
        28,          // min range
        36,          // max range
        30,          // spike at snapshot index 30
        42,          // heat wave spike
        'Mumbai Temperature spiked +31.3% from 32.00 to 42.00 — heat wave event'
    );

    console.log('\n✅ Database Seeded Successfully!');
    console.log('   3 datasets, 144 snapshots (48 each), multiple events created.');
    process.exit();
};

seedData().catch(err => {
    console.error(err);
    process.exit(1);
});
