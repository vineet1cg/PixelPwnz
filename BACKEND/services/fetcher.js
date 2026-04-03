const axios = require('axios');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const { detectChange } = require('./changeDetection');

// ═══════════════════════════════════════════
// 🛡️ DATABASE PROTECTION — Auto-cleanup
// Keep only the last N snapshots per dataset
// ═══════════════════════════════════════════
const MAX_SNAPSHOTS_PER_DATASET = parseInt(process.env.MAX_SNAPSHOTS) || 200;

const cleanupSnapshots = async (datasetId) => {
    const count = await Snapshot.countDocuments({ dataset_id: datasetId });
    if (count > MAX_SNAPSHOTS_PER_DATASET) {
        const toDelete = count - MAX_SNAPSHOTS_PER_DATASET;
        const oldest = await Snapshot.find({ dataset_id: datasetId })
            .sort({ timestamp: 1 })
            .limit(toDelete)
            .select('_id');
        await Snapshot.deleteMany({ _id: { $in: oldest.map(s => s._id) } });
    }
};

// ── Top 10 Cryptos (CoinGecko IDs) ──
const CRYPTOS = [
    { id: 'bitcoin', name: 'Bitcoin', symbol: 'BTC' },
    { id: 'ethereum', name: 'Ethereum', symbol: 'ETH' },
    { id: 'tether', name: 'Tether', symbol: 'USDT' },
    { id: 'binancecoin', name: 'BNB', symbol: 'BNB' },
    { id: 'solana', name: 'Solana', symbol: 'SOL' },
    { id: 'ripple', name: 'XRP', symbol: 'XRP' },
    { id: 'usd-coin', name: 'USD Coin', symbol: 'USDC' },
    { id: 'cardano', name: 'Cardano', symbol: 'ADA' },
    { id: 'dogecoin', name: 'Dogecoin', symbol: 'DOGE' },
    { id: 'tron', name: 'TRON', symbol: 'TRX' }
];

// ── Top 10 Indian Cities ──
const INDIAN_CITIES = [
    { name: 'Delhi', lat: 28.6139, lon: 77.2090, waqiSlug: 'delhi' },
    { name: 'Mumbai', lat: 19.0760, lon: 72.8777, waqiSlug: 'mumbai' },
    { name: 'Kolkata', lat: 22.5726, lon: 88.3639, waqiSlug: 'kolkata' },
    { name: 'Chennai', lat: 13.0827, lon: 80.2707, waqiSlug: 'chennai' },
    { name: 'Bangalore', lat: 12.9716, lon: 77.5946, waqiSlug: 'bangalore' },
    { name: 'Hyderabad', lat: 17.3850, lon: 78.4867, waqiSlug: 'hyderabad' },
    { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714, waqiSlug: 'ahmedabad' },
    { name: 'Pune', lat: 18.5204, lon: 73.8567, waqiSlug: 'pune' },
    { name: 'Jaipur', lat: 26.9124, lon: 75.7873, waqiSlug: 'jaipur' },
    { name: 'Lucknow', lat: 26.8467, lon: 80.9462, waqiSlug: 'lucknow' }
];

// ── 5 Global Cities for Weather Comparison ──
const GLOBAL_CITIES = [
    { name: 'New York', lat: 40.7128, lon: -74.0060 },
    { name: 'London', lat: 51.5074, lon: -0.1278 },
    { name: 'Tokyo', lat: 35.6762, lon: 139.6503 },
    { name: 'Dubai', lat: 25.2048, lon: 55.2708 },
    { name: 'Sydney', lat: -33.8688, lon: 151.2093 }
];

// ── Forex Pairs (vs USD) ──
const FOREX_PAIRS = [
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'EUR', name: 'Euro' },
    { code: 'GBP', name: 'British Pound' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'AUD', name: 'Australian Dollar' }
];

// ═══════════════════════════════════════════
// Save Snapshot Helper (with auto-cleanup)
// ═══════════════════════════════════════════
const saveSnapshot = async (datasetName, category, sourceApi, location, unit, value, metadata) => {
    let dataset = await Dataset.findOne({ name: datasetName });
    if (!dataset) {
        dataset = await Dataset.create({
            name: datasetName,
            category,
            source_api: sourceApi,
            location,
            unit,
            fetch_interval_minutes: 5
        });
    }

    const snapshot = await Snapshot.create({
        dataset_id: dataset._id,
        value,
        metadata
    });

    await detectChange(snapshot);
    await cleanupSnapshots(dataset._id);
    return snapshot;
};

// ═══════════════════════════════════════════
// 📈 CRYPTO — CoinGecko (no key, batch call)
// ═══════════════════════════════════════════
const fetchAllCrypto = async () => {
    try {
        const ids = CRYPTOS.map(c => c.id).join(',');
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

        for (const crypto of CRYPTOS) {
            const price = response.data[crypto.id]?.usd;
            if (price !== undefined) {
                await saveSnapshot(
                    `crypto-${crypto.id}`, 'crypto', 'coingecko', 'global', 'USD',
                    price, { symbol: crypto.symbol, raw: response.data[crypto.id] }
                );
                console.log(`  ✅ ${crypto.name}: $${price}`);
            }
        }
    } catch (error) {
        console.error('❌ Crypto fetch error:', error.message);
    }
};

// ═══════════════════════════════════════════
// 🌫️ AQI — WAQI (free token from aqicn.org)
// Sign up for free token: https://aqicn.org/data-platform/token/
// The 'demo' token returns SAME data for all cities!
// ═══════════════════════════════════════════
const fetchAllAQI = async () => {
    const token = process.env.WAQI_API_TOKEN || 'demo';
    if (token === 'demo') {
        console.warn('  ⚠️ Using WAQI demo token — all cities will show same AQI!');
        console.warn('  ⚠️ Get a free token: https://aqicn.org/data-platform/token/');
    }
    for (const city of INDIAN_CITIES) {
        try {
            const response = await axios.get(`https://api.waqi.info/feed/${city.waqiSlug}/?token=${token}`);
            if (response.data.status !== 'ok') continue;
            const pm25 = response.data.data.iaqi?.pm25?.v;
            const aqi = response.data.data.aqi;
            const value = pm25 || aqi;

            await saveSnapshot(
                `aqi-${city.name.toLowerCase()}`, 'air_quality', 'openaq', `${city.name}, India`, 'μg/m³',
                value, { aqi, pm25, dominentpol: response.data.data.dominentpol, time: response.data.data.time }
            );
            console.log(`  ✅ ${city.name} AQI: ${value} (PM2.5: ${pm25 || 'N/A'})`);
        } catch (error) {
            console.error(`  ❌ ${city.name} AQI error:`, error.message);
        }
    }
};

// ═══════════════════════════════════════════
// 🌡️ WEATHER — Open-Meteo (no key)
// India + Global cities
// ═══════════════════════════════════════════
const fetchAllWeather = async () => {
    // Indian cities
    for (const city of INDIAN_CITIES) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`
            );
            const value = response.data.current_weather.temperature;
            await saveSnapshot(
                `weather-${city.name.toLowerCase()}`, 'weather', 'openweather', `${city.name}, India`, '°C',
                value, response.data.current_weather
            );
            console.log(`  ✅ ${city.name}: ${value}°C`);
        } catch (error) {
            console.error(`  ❌ ${city.name} weather error:`, error.message);
        }
    }

    // Global cities
    for (const city of GLOBAL_CITIES) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`
            );
            const value = response.data.current_weather.temperature;
            await saveSnapshot(
                `weather-${city.name.toLowerCase().replace(/\s/g, '-')}`, 'weather', 'openweather', city.name, '°C',
                value, response.data.current_weather
            );
            console.log(`  ✅ ${city.name}: ${value}°C`);
        } catch (error) {
            console.error(`  ❌ ${city.name} weather error:`, error.message);
        }
    }
};

// ═══════════════════════════════════════════
// 💱 FOREX — ExchangeRate API (no key)
// ═══════════════════════════════════════════
const fetchAllForex = async () => {
    try {
        const response = await axios.get('https://open.er-api.com/v6/latest/USD');
        for (const pair of FOREX_PAIRS) {
            const rate = response.data.rates[pair.code];
            if (rate !== undefined) {
                await saveSnapshot(
                    `forex-usd-${pair.code.toLowerCase()}`, 'forex', 'coingecko', 'global', pair.code,
                    rate, { base: 'USD', target: pair.code, time_last_update: response.data.time_last_update_utc }
                );
                console.log(`  ✅ USD/${pair.code}: ${rate}`);
            }
        }
    } catch (error) {
        console.error('❌ Forex fetch error:', error.message);
    }
};

// ═══════════════════════════════════════════
// 🚀 MASTER FETCH
// ═══════════════════════════════════════════
const fetchAll = async () => {
    console.log('🔄 Fetching all sources...');
    console.log(`🛡️ Max snapshots per dataset: ${MAX_SNAPSHOTS_PER_DATASET}`);

    console.log('\n📈 Crypto (Top 10):');
    await fetchAllCrypto();

    console.log('\n🌫️ Air Quality (10 Indian Cities):');
    await fetchAllAQI();

    console.log('\n🌡️ Weather (10 Indian + 5 Global):');
    await fetchAllWeather();

    console.log('\n💱 Forex (5 pairs vs USD):');
    await fetchAllForex();

    console.log('\n✅ All fetches complete.');
};

// ── Single dataset fetcher (for fetch-now) ──
const fetchSingleDataset = async (datasetName) => {
    const cryptoMatch = CRYPTOS.find(c => `crypto-${c.id}` === datasetName);
    if (cryptoMatch) {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoMatch.id}&vs_currencies=usd`);
        const price = response.data[cryptoMatch.id]?.usd;
        if (price) await saveSnapshot(`crypto-${cryptoMatch.id}`, 'crypto', 'coingecko', 'global', 'USD', price, { symbol: cryptoMatch.symbol });
        return true;
    }

    const aqiMatch = INDIAN_CITIES.find(c => `aqi-${c.name.toLowerCase()}` === datasetName);
    if (aqiMatch) {
        const token = process.env.WAQI_API_TOKEN || 'demo';
        const response = await axios.get(`https://api.waqi.info/feed/${aqiMatch.waqiSlug}/?token=${token}`);
        if (response.data.status === 'ok') {
            const pm25 = response.data.data.iaqi?.pm25?.v;
            const aqi = response.data.data.aqi;
            await saveSnapshot(`aqi-${aqiMatch.name.toLowerCase()}`, 'air_quality', 'openaq', `${aqiMatch.name}, India`, 'μg/m³', pm25 || aqi, { aqi, pm25 });
        }
        return true;
    }

    const allCities = [...INDIAN_CITIES.map(c => ({ ...c, loc: `${c.name}, India` })), ...GLOBAL_CITIES.map(c => ({ ...c, loc: c.name }))];
    const weatherMatch = allCities.find(c => `weather-${c.name.toLowerCase().replace(/\s/g, '-')}` === datasetName);
    if (weatherMatch) {
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${weatherMatch.lat}&longitude=${weatherMatch.lon}&current_weather=true`);
        const temp = response.data.current_weather.temperature;
        await saveSnapshot(datasetName, 'weather', 'openweather', weatherMatch.loc, '°C', temp, response.data.current_weather);
        return true;
    }

    const forexMatch = FOREX_PAIRS.find(p => `forex-usd-${p.code.toLowerCase()}` === datasetName);
    if (forexMatch) {
        const response = await axios.get('https://open.er-api.com/v6/latest/USD');
        const rate = response.data.rates[forexMatch.code];
        if (rate) await saveSnapshot(datasetName, 'forex', 'coingecko', 'global', forexMatch.code, rate, { base: 'USD', target: forexMatch.code });
        return true;
    }

    return false;
};

module.exports = { fetchAll, fetchAllCrypto, fetchAllAQI, fetchAllWeather, fetchAllForex, fetchSingleDataset, CRYPTOS, INDIAN_CITIES, GLOBAL_CITIES, FOREX_PAIRS };
