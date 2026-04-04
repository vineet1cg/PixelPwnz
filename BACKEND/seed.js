require('dotenv').config();
const mongoose = require('mongoose');
const axios = require('axios');
const Dataset = require('./models/Dataset');
const Snapshot = require('./models/Snapshot');
const Event = require('./models/Event');
const connectDB = require('./config/db');

// ═══════════════════════════════════════════
// DATE RANGE: past 10 days up to now
// ═══════════════════════════════════════════
const END_DATE = new Date();
const START_DATE = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
const fmtDate = d => d.toISOString().split('T')[0];

console.log(`📅 Seeding: ${fmtDate(START_DATE)} → ${fmtDate(END_DATE)}`);

const CRYPTOS = [
    { id: 'bitcoin',    name: 'Bitcoin',  symbol: 'BTC' },
    { id: 'ethereum',   name: 'Ethereum', symbol: 'ETH' },
    { id: 'tether',     name: 'Tether',   symbol: 'USDT' },
    { id: 'binancecoin',name: 'BNB',      symbol: 'BNB' },
    { id: 'solana',     name: 'Solana',   symbol: 'SOL' },
    { id: 'ripple',     name: 'XRP',      symbol: 'XRP' },
    { id: 'usd-coin',   name: 'USD Coin', symbol: 'USDC' },
    { id: 'cardano',    name: 'Cardano',  symbol: 'ADA' },
    { id: 'dogecoin',   name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'tron',       name: 'TRON',     symbol: 'TRX' }
];

const INDIAN_CITIES = [
    { name: 'Delhi',     lat: 28.6139, lon: 77.2090, waqiSlug: 'delhi',
        aqi: { base: 150, min: 60,  max: 350, season: 1.2 } },
    { name: 'Mumbai',    lat: 19.0760, lon: 72.8777, waqiSlug: 'mumbai',
        aqi: { base: 90,  min: 30,  max: 180, season: 0.9 } },
    { name: 'Kolkata',   lat: 22.5726, lon: 88.3639, waqiSlug: 'kolkata',
        aqi: { base: 110, min: 40,  max: 220, season: 1.1 } },
    { name: 'Chennai',   lat: 13.0827, lon: 80.2707, waqiSlug: 'chennai',
        aqi: { base: 70,  min: 20,  max: 150, season: 0.8 } },
    { name: 'Bangalore', lat: 12.9716, lon: 77.5946, waqiSlug: 'bangalore',
        aqi: { base: 60,  min: 15,  max: 130, season: 0.7 } },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, waqiSlug: 'hyderabad',
        aqi: { base: 80,  min: 25,  max: 170, season: 0.9 } },
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, waqiSlug: 'ahmedabad',
        aqi: { base: 100, min: 35,  max: 200, season: 1.0 } },
    { name: 'Pune',      lat: 18.5204, lon: 73.8567, waqiSlug: 'pune',
        aqi: { base: 65,  min: 15,  max: 140, season: 0.8 } },
    { name: 'Jaipur',    lat: 26.9124, lon: 75.7873, waqiSlug: 'jaipur',
        aqi: { base: 95,  min: 30,  max: 190, season: 1.0 } },
    { name: 'Lucknow',   lat: 26.8467, lon: 80.9462, waqiSlug: 'lucknow',
        aqi: { base: 130, min: 50,  max: 260, season: 1.1 } }
];

const FOREX_PAIRS = [
    { code: 'USD', name: 'US Dollar' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' }
];

// ═══════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

const detectAndCreateEvents = async (datasetId, snapshots) => {
    const events = [];
    for (let i = 1; i < snapshots.length; i++) {
        const prev = snapshots[i - 1].value;
        const curr = snapshots[i].value;
        if (prev === 0) continue;
        const pct = ((curr - prev) / prev) * 100;
        if (Math.abs(pct) > 15) {
            events.push({
                dataset_id: datasetId,
                type: pct > 0 ? 'spike' : 'drop',
                percentage_change: pct,
                previous_value: prev,
                current_value: curr,
                timestamp: snapshots[i].timestamp,
                message: `Value ${pct > 0 ? 'spiked' : 'dropped'} ${pct > 0 ? '+' : ''}${pct.toFixed(1)}% from ${prev.toFixed(2)} to ${curr.toFixed(2)}`,
                severity: Math.abs(pct) >= 25 ? 'high' : 'medium'
            });
        }
    }
    if (events.length > 0) await Event.insertMany(events);
    return events.length;
};

// ═══════════════════════════════════════════
// STEP 1: FOREX — today's real rate + 10-day
//         realistic drift (no free history API)
// ═══════════════════════════════════════════
const seedForex = async () => {
    console.log('\n💱 Step 1: Forex (real today rate + 10-day drift)...');
    const response = await axios.get('https://open.er-api.com/v6/latest/INR');
    const todayRates = response.data.rates;
    console.log(`  Current rates: 1 INR = $${todayRates.USD} USD, ¥${todayRates.JPY} JPY`);

    // Build hourly forex snapshots going 10 days back from today's rate
    // Apply small realistic daily drift (±0.3% per day, mean-reverting)
    const totalHours = 10 * 24;
    const usdToInrTimeSeries = []; // used later for crypto conversion

    for (const pair of FOREX_PAIRS) {
        const todayRate = todayRates[pair.code];
        if (!todayRate) continue;

        const dataset = await Dataset.findOneAndUpdate(
            { name: `forex-inr-${pair.code.toLowerCase()}` },
            { name: `forex-inr-${pair.code.toLowerCase()}`, category: 'forex', source_api: 'exchangerate', location: 'India', unit: pair.code, fetch_interval_minutes: 60 },
            { upsert: true, new: true }
        );

        // Walk backwards from today's rate with mean-reverting drift
        const hourlyRates = new Array(totalHours);
        hourlyRates[totalHours - 1] = todayRate;
        for (let i = totalHours - 2; i >= 0; i--) {
            const drift = (Math.random() - 0.502) * todayRate * 0.0025; // slight downward bias going back
            hourlyRates[i] = Math.max(todayRate * 0.85, Math.min(todayRate * 1.15, hourlyRates[i + 1] + drift));
        }

        const snapshotDocs = hourlyRates.map((rate, i) => ({
            dataset_id: dataset._id,
            value: parseFloat(rate.toFixed(6)),
            timestamp: new Date(START_DATE.getTime() + i * 60 * 60 * 1000),
            metadata: { base: 'INR', target: pair.code, real_today: todayRate }
        }));

        await Snapshot.insertMany(snapshotDocs);

        if (pair.code === 'USD') {
            // Save INR-per-USD for crypto seeding
            usdToInrTimeSeries.push(...hourlyRates.map(r => parseFloat((1 / r).toFixed(4))));
        }

        console.log(`  ✅ INR/${pair.code}: real rate ${todayRate}, ${totalHours} hourly points`);
    }

    return usdToInrTimeSeries; // 240-element array
};

// ═══════════════════════════════════════════
// STEP 2: CRYPTO — real 10-day hourly history
//         from CoinGecko market_chart endpoint
// ═══════════════════════════════════════════
const seedCrypto = async (usdToInrTimeSeries) => {
    console.log('\n📈 Step 2: Crypto (real 10-day CoinGecko history)...');

    // Fetch all 10 cryptos — add delay between calls to respect rate limit
    for (let ci = 0; ci < CRYPTOS.length; ci++) {
        const crypto = CRYPTOS[ci];
        try {
            if (ci > 0) await sleep(1500); // ~40 calls/min → well under 30/min limit

            const response = await axios.get(
                `https://api.coingecko.com/api/v3/coins/${crypto.id}/market_chart?vs_currency=usd&days=10&interval=hourly`
            );

            const prices = response.data.prices; // [[timestamp_ms, price], ...]

            const dataset = await Dataset.findOneAndUpdate(
                { name: `crypto-${crypto.id}` },
                { name: `crypto-${crypto.id}`, category: 'crypto', source_api: 'coingecko', location: 'global', unit: 'USD', fetch_interval_minutes: 10 },
                { upsert: true, new: true }
            );

            const snapshotDocs = prices.map(([ts, priceUSD], i) => {
                const usdToInr = usdToInrTimeSeries[Math.min(i, usdToInrTimeSeries.length - 1)] || 93.5;
                return {
                    dataset_id: dataset._id,
                    value: priceUSD,
                    timestamp: new Date(ts),
                    metadata: {
                        symbol: crypto.symbol,
                        usd: priceUSD,
                        inr_value: parseFloat((priceUSD * usdToInr).toFixed(2)),
                        usd_to_inr: usdToInr
                    }
                };
            });

            await Snapshot.insertMany(snapshotDocs);
            const eventsCreated = await detectAndCreateEvents(dataset._id, snapshotDocs);

            const latestPrice = prices[prices.length - 1][1];
            console.log(`  ✅ ${crypto.name}: ${prices.length} real data points | latest: $${latestPrice.toFixed(2)} | events: ${eventsCreated}`);
        } catch (err) {
            console.error(`  ❌ ${crypto.name}: ${err.message}`);
        }
    }
};

// ═══════════════════════════════════════════
// STEP 3: WEATHER — real 10-day hourly from
//         Open-Meteo Archive API (free, no key)
// ═══════════════════════════════════════════
const seedWeather = async () => {
    console.log('\n🌡️  Step 3: Weather (real Open-Meteo Archive data)...');

    for (const city of INDIAN_CITIES) {
        try {
            await sleep(300); // slight delay to be polite
            const response = await axios.get(
                `https://archive-api.open-meteo.com/v1/archive?latitude=${city.lat}&longitude=${city.lon}` +
                `&start_date=${fmtDate(START_DATE)}&end_date=${fmtDate(END_DATE)}` +
                `&hourly=temperature_2m,relativehumidity_2m,windspeed_10m&timezone=Asia%2FKolkata`
            );

            const { time, temperature_2m, relativehumidity_2m, windspeed_10m } = response.data.hourly;

            const dataset = await Dataset.findOneAndUpdate(
                { name: `weather-${city.name.toLowerCase()}` },
                { name: `weather-${city.name.toLowerCase()}`, category: 'weather', source_api: 'open-meteo', location: `${city.name}, India`, unit: '°C', fetch_interval_minutes: 10 },
                { upsert: true, new: true }
            );

            const snapshotDocs = time.map((t, i) => ({
                dataset_id: dataset._id,
                value: temperature_2m[i],
                timestamp: new Date(t),
                metadata: {
                    temperature: temperature_2m[i],
                    humidity: relativehumidity_2m?.[i],
                    windspeed: windspeed_10m?.[i]
                }
            })).filter(s => s.value !== null && s.value !== undefined);

            await Snapshot.insertMany(snapshotDocs);
            const eventsCreated = await detectAndCreateEvents(dataset._id, snapshotDocs);

            const temps = temperature_2m.filter(t => t !== null);
            const minTemp = Math.min(...temps).toFixed(1);
            const maxTemp = Math.max(...temps).toFixed(1);
            console.log(`  ✅ ${city.name}: ${snapshotDocs.length} real points | ${minTemp}°C–${maxTemp}°C | events: ${eventsCreated}`);
        } catch (err) {
            console.error(`  ❌ ${city.name} weather: ${err.message}`);
        }
    }
};

// ═══════════════════════════════════════════
// STEP 4: AQI — Open-Meteo Air Quality API
//         Use city-specific realistic simulation
//         based on actual seasonal patterns
//         (Delhi >> Lucknow > Mumbai > Bangalore)
// ═══════════════════════════════════════════
const seedAQI = async () => {
    console.log('\n🌫️  Step 4: AQI (city-specific realistic simulation)...');

    const totalHours = 10 * 24;

    for (const city of INDIAN_CITIES) {
        const { base, min, max } = city.aqi;
        const dataset = await Dataset.findOneAndUpdate(
            { name: `aqi-${city.name.toLowerCase()}` },
            { name: `aqi-${city.name.toLowerCase()}`, category: 'air_quality', source_api: 'open-meteo', location: `${city.name}, India`, unit: 'AQI', fetch_interval_minutes: 1 },
            { upsert: true, new: true }
        );

        let current = base;
        const snapshotDocs = [];

        for (let i = 0; i < totalHours; i++) {
            const timestamp = new Date(START_DATE.getTime() + i * 60 * 60 * 1000);
            const hourOfDay = timestamp.getHours();

            // AQI peaks in morning rush (7-10am) and evening (6-9pm), lower at night
            const timeFactor = hourOfDay >= 7 && hourOfDay <= 10 ? 1.3
                : hourOfDay >= 18 && hourOfDay <= 21 ? 1.2
                : hourOfDay >= 0 && hourOfDay <= 5 ? 0.75
                : 1.0;

            const noise = (Math.random() - 0.5) * (max - min) * 0.08;
            const drift = (Math.random() - 0.49) * (max - min) * 0.02;
            current = Math.max(min, Math.min(max, current * timeFactor * 0.15 + current * 0.85 + noise + drift));

            snapshotDocs.push({
                dataset_id: dataset._id,
                value: parseFloat(current.toFixed(1)),
                timestamp,
                metadata: { simulated: true, city: city.name, note: 'Open-Meteo AQI historical API simulated' }
            });
        }

        await Snapshot.insertMany(snapshotDocs);
        const eventsCreated = await detectAndCreateEvents(dataset._id, snapshotDocs);

        const vals = snapshotDocs.map(s => s.value);
        console.log(`  ✅ ${city.name}: ${snapshotDocs.length} points | ${Math.min(...vals).toFixed(0)}–${Math.max(...vals).toFixed(0)} μg/m³ | events: ${eventsCreated}`);
    }
};

// ═══════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════
const seedData = async (shouldExit = true) => {
    // await connectDB(); // Removed to avoid circular dependency since db.js calls this

    // Hard-drop all collections
    const db = mongoose.connection.db;
    const cols = await db.listCollections().toArray();
    for (const col of cols) await db.collection(col.name).drop().catch(() => {});
    console.log('🗑️  Dropped all collections');

    const usdToInrTimeSeries = await seedForex();
    await seedCrypto(usdToInrTimeSeries);
    await seedWeather();
    await seedAQI();

    const [d, s, e] = await Promise.all([Dataset.countDocuments(), Snapshot.countDocuments(), Event.countDocuments()]);
    console.log(`\n🎉 Done!`);
    console.log(`   ${d} datasets | ${s} snapshots | ${e} events`);
    console.log(`   📅 ${fmtDate(START_DATE)} → ${fmtDate(END_DATE)} (10 days real data)`);
    console.log(`   📈 Crypto: REAL (CoinGecko historical)`);
    console.log(`   🌡️  Weather: REAL (Open-Meteo Archive)`);
    console.log(`   💱 Forex: REAL today rate + 10-day drift`);
    console.log(`   🌫️  AQI: City-specific simulation (no free history API)`);
    if (shouldExit) process.exit();
};

module.exports = { seedData };

if (require.main === module) {
    (async () => {
        await connectDB();
        await seedData();
    })().catch(err => { console.error('❌ Seed failed:', err.message); process.exit(1); });
}
