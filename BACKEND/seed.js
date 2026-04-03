require('dotenv').config();
const mongoose = require('mongoose');
const Dataset = require('./models/Dataset');
const Snapshot = require('./models/Snapshot');
const Event = require('./models/Event');
const connectDB = require('./config/db');

// ═══════════════════════════════════════════
// DATA DEFINITIONS
// ═══════════════════════════════════════════

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

const GLOBAL_CITIES = [
    { name: 'New York', temp: { base: 15, min: 8, max: 22 } },
    { name: 'London', temp: { base: 12, min: 5, max: 18 } },
    { name: 'Tokyo', temp: { base: 18, min: 10, max: 25 } },
    { name: 'Dubai', temp: { base: 38, min: 32, max: 48 } },
    { name: 'Sydney', temp: { base: 22, min: 16, max: 28 } }
];

const FOREX_PAIRS = [
    { code: 'INR', name: 'Indian Rupee', base: 85.5, min: 82, max: 89 },
    { code: 'EUR', name: 'Euro', base: 0.92, min: 0.88, max: 0.96 },
    { code: 'GBP', name: 'British Pound', base: 0.79, min: 0.75, max: 0.83 },
    { code: 'JPY', name: 'Japanese Yen', base: 150, min: 140, max: 160 },
    { code: 'AUD', name: 'Australian Dollar', base: 1.55, min: 1.45, max: 1.65 }
];

// ═══════════════════════════════════════════
// HELPER: Generate snapshots + events
// ═══════════════════════════════════════════
const generateSnapshots = async (dataset, baseValue, minVal, maxVal, spikeConfig) => {
    let currentValue = baseValue;

    for (let i = 0; i < 48; i++) {
        const timestamp = new Date(Date.now() - (48 - i) * 60 * 60 * 1000);

        if (spikeConfig && i === spikeConfig.index) {
            const previousValue = currentValue;
            currentValue = spikeConfig.value;
            const pct = ((currentValue - previousValue) / previousValue) * 100;

            await Snapshot.create({ dataset_id: dataset._id, value: currentValue, timestamp });

            if (Math.abs(pct) > 15) {
                await Event.create({
                    dataset_id: dataset._id,
                    type: pct > 0 ? 'spike' : 'drop',
                    percentage_change: pct,
                    previous_value: previousValue,
                    current_value: currentValue,
                    timestamp,
                    message: spikeConfig.message,
                    severity: Math.abs(pct) >= 25 ? 'high' : 'medium'
                });
            }
        } else {
            const fluctuation = (Math.random() - 0.5) * (maxVal - minVal) * 0.08;
            currentValue = Math.max(minVal, Math.min(maxVal, currentValue + fluctuation));
            await Snapshot.create({ dataset_id: dataset._id, value: currentValue, timestamp });
        }
    }
};

// ═══════════════════════════════════════════
// SEED
// ═══════════════════════════════════════════
const seedData = async () => {
    await connectDB();
    await Dataset.deleteMany();
    await Snapshot.deleteMany();
    await Event.deleteMany();
    console.log('Cleared existing data...\n');

    // ── CRYPTO (10) ──
    console.log('📈 Crypto (10)...');
    const cryptoSpikes = {
        bitcoin:     { index: 20, value: 69700, message: 'Bitcoin dropped -18% — major market sell-off' },
        ethereum:    { index: 25, value: 3904, message: 'Ethereum spiked +22% — ETF approval rally' },
        solana:      { index: 18, value: 105, message: 'Solana dropped -25% — network outage fears' },
        dogecoin:    { index: 30, value: 0.247, message: 'Dogecoin spiked +45% — viral social media pump' }
    };
    for (const c of CRYPTOS) {
        const ds = await Dataset.create({ name: `crypto-${c.id}`, category: 'crypto', source_api: 'coingecko', location: 'global', unit: 'USD', fetch_interval_minutes: 5 });
        await generateSnapshots(ds, c.base, c.min, c.max, cryptoSpikes[c.id] || null);
        console.log(`  ✅ ${c.name}`);
    }

    // ── AQI (10 Indian) ──
    console.log('\n🌫️  AQI (10 Indian cities)...');
    const aqiSpikes = {
        Delhi:   { index: 15, value: 320, message: 'Delhi PM2.5 spiked to 320 — severe smog, possible stubble burning' },
        Lucknow: { index: 22, value: 280, message: 'Lucknow AQI spiked to 280 — hazardous air quality' },
        Kolkata: { index: 28, value: 250, message: 'Kolkata AQI spiked to 250 — industrial emissions surge' }
    };
    for (const city of INDIAN_CITIES) {
        const ds = await Dataset.create({ name: `aqi-${city.name.toLowerCase()}`, category: 'air_quality', source_api: 'openaq', location: `${city.name}, India`, unit: 'μg/m³', fetch_interval_minutes: 5 });
        await generateSnapshots(ds, city.aqi.base, city.aqi.min, city.aqi.max, aqiSpikes[city.name] || null);
        console.log(`  ✅ ${city.name}`);
    }

    // ── WEATHER Indian (10) ──
    console.log('\n🌡️  Weather India (10)...');
    const weatherSpikes = {
        Delhi:     { index: 20, value: 46, message: 'Delhi temp spiked to 46°C — extreme heat wave' },
        Ahmedabad: { index: 25, value: 48, message: 'Ahmedabad temp spiked to 48°C — record-breaking heat' },
        Mumbai:    { index: 30, value: 42, message: 'Mumbai temp spiked to 42°C — heat wave event' }
    };
    for (const city of INDIAN_CITIES) {
        const ds = await Dataset.create({ name: `weather-${city.name.toLowerCase()}`, category: 'weather', source_api: 'openweather', location: `${city.name}, India`, unit: '°C', fetch_interval_minutes: 5 });
        await generateSnapshots(ds, city.temp.base, city.temp.min, city.temp.max, weatherSpikes[city.name] || null);
        console.log(`  ✅ ${city.name}`);
    }

    // ── WEATHER Global (5) ──
    console.log('\n🌍 Weather Global (5)...');
    const globalSpikes = {
        Dubai: { index: 22, value: 52, message: 'Dubai temp spiked to 52°C — extreme desert heat' }
    };
    for (const city of GLOBAL_CITIES) {
        const slug = city.name.toLowerCase().replace(/\s/g, '-');
        const ds = await Dataset.create({ name: `weather-${slug}`, category: 'weather', source_api: 'openweather', location: city.name, unit: '°C', fetch_interval_minutes: 5 });
        await generateSnapshots(ds, city.temp.base, city.temp.min, city.temp.max, globalSpikes[city.name] || null);
        console.log(`  ✅ ${city.name}`);
    }

    // ── FOREX (5) ──
    console.log('\n💱 Forex (5 pairs vs USD)...');
    const forexSpikes = {
        INR: { index: 20, value: 92, message: 'USD/INR spiked to 92 — rupee under pressure' },
        JPY: { index: 25, value: 170, message: 'USD/JPY spiked to 170 — yen freefall continues' }
    };
    for (const pair of FOREX_PAIRS) {
        const ds = await Dataset.create({ name: `forex-usd-${pair.code.toLowerCase()}`, category: 'forex', source_api: 'exchangerate', location: 'global', unit: pair.code, fetch_interval_minutes: 5 });
        await generateSnapshots(ds, pair.base, pair.min, pair.max, forexSpikes[pair.code] || null);
        console.log(`  ✅ USD/${pair.code}`);
    }

    // ── SUMMARY ──
    const [d, s, e] = await Promise.all([Dataset.countDocuments(), Snapshot.countDocuments(), Event.countDocuments()]);
    console.log(`\n🎉 Seeded! ${d} datasets | ${s} snapshots | ${e} events`);
    console.log(`🛡️ Max ${parseInt(process.env.MAX_SNAPSHOTS) || 200} snapshots/dataset enforced at runtime`);
    process.exit();
};

seedData().catch(err => { console.error(err); process.exit(1); });
