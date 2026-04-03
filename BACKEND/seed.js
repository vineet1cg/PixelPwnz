require('dotenv').config();
const mongoose = require('mongoose');
const Dataset = require('./models/Dataset');
const Snapshot = require('./models/Snapshot');
const Event = require('./models/Event');
const connectDB = require('./config/db');

// ── Top 10 Cryptos with realistic price ranges ──
const CRYPTOS = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC', base: 85000, min: 80000, max: 90000 },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH', base: 3200, min: 2900, max: 3500 },
    { id: 'tether', name: 'Tether', symbol: 'USDT', base: 1.0, min: 0.99, max: 1.01 },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB', base: 600, min: 550, max: 650 },
    { id: 'solana', name: 'Solana', symbol: 'SOL', base: 140, min: 120, max: 160 },
    { id: 'ripple', name: 'XRP', symbol: 'XRP', base: 2.1, min: 1.8, max: 2.5 },
    { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC', base: 1.0, min: 0.99, max: 1.01 },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA', base: 0.65, min: 0.50, max: 0.80 },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE', base: 0.17, min: 0.12, max: 0.22 },
    { id: 'tron', name: 'TRON', symbol: 'TRX', base: 0.24, min: 0.20, max: 0.28 }
];

// ── Top 10 Indian Cities with realistic AQI and temperature data ──
const INDIAN_CITIES = [
    { name: 'Delhi', aqi: { base: 150, min: 80, max: 300 }, temp: { base: 34, min: 28, max: 42 } },
    { name: 'Mumbai', aqi: { base: 90, min: 40, max: 180 }, temp: { base: 32, min: 28, max: 38 } },
    { name: 'Kolkata', aqi: { base: 110, min: 60, max: 220 }, temp: { base: 33, min: 27, max: 40 } },
    { name: 'Chennai', aqi: { base: 70, min: 30, max: 150 }, temp: { base: 34, min: 30, max: 40 } },
    { name: 'Bangalore', aqi: { base: 60, min: 25, max: 130 }, temp: { base: 28, min: 22, max: 35 } },
    { name: 'Hyderabad', aqi: { base: 80, min: 35, max: 170 }, temp: { base: 35, min: 28, max: 42 } },
    { name: 'Ahmedabad', aqi: { base: 100, min: 50, max: 200 }, temp: { base: 36, min: 30, max: 44 } },
    { name: 'Pune', aqi: { base: 65, min: 25, max: 140 }, temp: { base: 30, min: 24, max: 38 } },
    { name: 'Jaipur', aqi: { base: 95, min: 45, max: 190 }, temp: { base: 35, min: 28, max: 44 } },
    { name: 'Lucknow', aqi: { base: 130, min: 70, max: 250 }, temp: { base: 33, min: 26, max: 42 } }
];

// ── Helper: generate 48 snapshots + spike events ──
const generateSnapshots = async (dataset, baseValue, minVal, maxVal, spikeConfig) => {
    let currentValue = baseValue;

    for (let i = 0; i < 48; i++) {
        const timestamp = new Date(Date.now() - (48 - i) * 60 * 60 * 1000); // 1-hour intervals

        if (spikeConfig && i === spikeConfig.index) {
            const previousValue = currentValue;
            currentValue = spikeConfig.value;
            const percentageChange = ((currentValue - previousValue) / previousValue) * 100;

            await Snapshot.create({ dataset_id: dataset._id, value: currentValue, timestamp });

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
                    message: spikeConfig.message || `${dataset.name} ${type === 'spike' ? 'spiked' : 'dropped'} ${percentageChange > 0 ? '+' : ''}${percentageChange.toFixed(1)}%`,
                    severity
                });
                console.log(`    Event: ${spikeConfig.message || type}`);
            }
        } else {
            const fluctuation = (Math.random() - 0.5) * (maxVal - minVal) * 0.08;
            currentValue = Math.max(minVal, Math.min(maxVal, currentValue + fluctuation));
            await Snapshot.create({ dataset_id: dataset._id, value: currentValue, timestamp });
        }
    }
};

const seedData = async () => {
    await connectDB();

    // Clear existing data
    await Dataset.deleteMany();
    await Snapshot.deleteMany();
    await Event.deleteMany();
    console.log('Cleared existing data...\n');

    // ═══════════════════════════════════
    // SEED CRYPTO (10 datasets)
    // ═══════════════════════════════════
    console.log('📈 Seeding Crypto (10 datasets)...');
    for (const crypto of CRYPTOS) {
        const dataset = await Dataset.create({
            name: `crypto-${crypto.id}`,
            category: 'crypto',
            source_api: 'coingecko',
            location: 'global',
            unit: 'USD',
            fetch_interval_minutes: 5
        });

        // Give some cryptos dramatic events
        let spikeConfig = null;
        if (crypto.id === 'bitcoin') {
            spikeConfig = { index: 20, value: crypto.base * 0.82, message: `Bitcoin dropped -18.0% — major market sell-off` };
        } else if (crypto.id === 'ethereum') {
            spikeConfig = { index: 25, value: crypto.base * 1.22, message: `Ethereum spiked +22.0% — ETF approval rally` };
        } else if (crypto.id === 'dogecoin') {
            spikeConfig = { index: 30, value: crypto.base * 1.45, message: `Dogecoin spiked +45.0% — viral social media pump` };
        } else if (crypto.id === 'solana') {
            spikeConfig = { index: 18, value: crypto.base * 0.75, message: `Solana dropped -25.0% — network outage fears` };
        }

        await generateSnapshots(dataset, crypto.base, crypto.min, crypto.max, spikeConfig);
        console.log(`  ✅ ${crypto.name} (${crypto.symbol}): 48 snapshots`);
    }

    // ═══════════════════════════════════
    // SEED AQI (10 datasets)
    // ═══════════════════════════════════
    console.log('\n🌫️ Seeding Air Quality (10 Indian cities)...');
    for (const city of INDIAN_CITIES) {
        const dataset = await Dataset.create({
            name: `aqi-${city.name.toLowerCase()}`,
            category: 'air_quality',
            source_api: 'openaq',
            location: `${city.name}, India`,
            unit: 'μg/m³',
            fetch_interval_minutes: 5
        });

        let spikeConfig = null;
        if (city.name === 'Delhi') {
            spikeConfig = { index: 15, value: 320, message: `Delhi PM2.5 spiked to 320 μg/m³ — severe smog event, possible stubble burning` };
        } else if (city.name === 'Lucknow') {
            spikeConfig = { index: 22, value: 280, message: `Lucknow AQI spiked to 280 — hazardous air quality` };
        } else if (city.name === 'Kolkata') {
            spikeConfig = { index: 28, value: 250, message: `Kolkata AQI spiked to 250 — industrial emissions surge` };
        }

        await generateSnapshots(dataset, city.aqi.base, city.aqi.min, city.aqi.max, spikeConfig);
        console.log(`  ✅ ${city.name}: 48 snapshots`);
    }

    // ═══════════════════════════════════
    // SEED WEATHER (10 datasets)
    // ═══════════════════════════════════
    console.log('\n🌡️ Seeding Weather (10 Indian cities)...');
    for (const city of INDIAN_CITIES) {
        const dataset = await Dataset.create({
            name: `weather-${city.name.toLowerCase()}`,
            category: 'weather',
            source_api: 'openweather',
            location: `${city.name}, India`,
            unit: '°C',
            fetch_interval_minutes: 5
        });

        let spikeConfig = null;
        if (city.name === 'Delhi') {
            spikeConfig = { index: 20, value: 46, message: `Delhi temperature spiked to 46°C — extreme heat wave` };
        } else if (city.name === 'Ahmedabad') {
            spikeConfig = { index: 25, value: 48, message: `Ahmedabad temperature spiked to 48°C — record-breaking heat` };
        } else if (city.name === 'Mumbai') {
            spikeConfig = { index: 30, value: 42, message: `Mumbai temperature spiked to 42°C — heat wave event` };
        }

        await generateSnapshots(dataset, city.temp.base, city.temp.min, city.temp.max, spikeConfig);
        console.log(`  ✅ ${city.name}: 48 snapshots`);
    }

    // ═══════════════════════════════════
    // SUMMARY
    // ═══════════════════════════════════
    const totalDatasets = await Dataset.countDocuments();
    const totalSnapshots = await Snapshot.countDocuments();
    const totalEvents = await Event.countDocuments();

    console.log(`\n🎉 Database Seeded Successfully!`);
    console.log(`   ${totalDatasets} datasets | ${totalSnapshots} snapshots | ${totalEvents} events`);
    process.exit();
};

seedData().catch(err => {
    console.error(err);
    process.exit(1);
});
