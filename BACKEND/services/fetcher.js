const axios = require('axios');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const { detectChange } = require('./changeDetection');

// ═══════════════════════════════════════════
// 🛡️ DATABASE PROTECTION — Auto-cleanup
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

// ═══════════════════════════════════════════
// 📈 Top 10 Cryptos (CoinGecko)
// Rate limit: 10-30 calls/min free tier → 10 min safe
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// 🇮🇳 Top 10 Indian Cities (AQI + Weather)
// ═══════════════════════════════════════════
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

// ═══════════════════════════════════════════
// 💱 Forex pairs (vs INR — India focus)
// ═══════════════════════════════════════════
const FOREX_PAIRS = [
    { code: 'USD', name: 'US Dollar' },
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
            fetch_interval_minutes: 10
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
// 📈 CRYPTO — CoinGecko (no key needed)
// Free tier: ~30 calls/min → 1 batch call every 10 min = safe
// ═══════════════════════════════════════════
const fetchAllCrypto = async () => {
    try {
        const ids = CRYPTOS.map(c => c.id).join(',');
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=inr,usd`);

        for (const crypto of CRYPTOS) {
            const priceUSD = response.data[crypto.id]?.usd;
            const priceINR = response.data[crypto.id]?.inr;
            if (priceUSD !== undefined) {
                await saveSnapshot(
                    `crypto-${crypto.id}`, 'crypto', 'coingecko', 'India', 'INR',
                    priceINR || priceUSD,
                    { symbol: crypto.symbol, usd: priceUSD, inr: priceINR }
                );
                console.log(`  ✅ ${crypto.name}: ₹${priceINR} ($${priceUSD})`);
            }
        }
    } catch (error) {
        console.error('❌ Crypto fetch error:', error.message);
    }
};

// ═══════════════════════════════════════════
// 🌫️ AQI — WAQI (free token from aqicn.org)
// Free tier: 1000 requests/day → 10 cities × 144 fetches/day = 1440
// → Use 15 min interval for AQI to stay under 1000/day (960/day)
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
            const pm10 = response.data.data.iaqi?.pm10?.v;
            const aqi = response.data.data.aqi;
            const value = pm25 || aqi;

            await saveSnapshot(
                `aqi-${city.name.toLowerCase()}`, 'air_quality', 'waqi', `${city.name}, India`, 'μg/m³',
                value, { aqi, pm25, pm10, dominentpol: response.data.data.dominentpol, time: response.data.data.time }
            );
            console.log(`  ✅ ${city.name}: AQI ${aqi} | PM2.5: ${pm25 || 'N/A'} | PM10: ${pm10 || 'N/A'}`);
        } catch (error) {
            console.error(`  ❌ ${city.name} AQI error:`, error.message);
        }
    }
};

// ═══════════════════════════════════════════
// 🌡️ WEATHER — Open-Meteo (no key, India only)
// Free tier: 10,000 requests/day → 10 cities × 144/day = 1440 → safe at 10 min
// ═══════════════════════════════════════════
const fetchAllWeather = async () => {
    for (const city of INDIAN_CITIES) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true&hourly=relativehumidity_2m`
            );
            const weather = response.data.current_weather;
            const humidity = response.data.hourly?.relativehumidity_2m?.[0];

            await saveSnapshot(
                `weather-${city.name.toLowerCase()}`, 'weather', 'open-meteo', `${city.name}, India`, '°C',
                weather.temperature,
                { ...weather, humidity }
            );
            console.log(`  ✅ ${city.name}: ${weather.temperature}°C | Wind: ${weather.windspeed} km/h`);
        } catch (error) {
            console.error(`  ❌ ${city.name} weather error:`, error.message);
        }
    }
};

// ═══════════════════════════════════════════
// 💱 FOREX — ExchangeRate API (no key, INR base)
// Free tier: Updates once/day → fetch every 60 min is plenty
// ═══════════════════════════════════════════
const fetchAllForex = async () => {
    try {
        const response = await axios.get('https://open.er-api.com/v6/latest/INR');
        for (const pair of FOREX_PAIRS) {
            const rate = response.data.rates[pair.code];
            if (rate !== undefined) {
                // Store as "1 INR = X foreign currency"
                await saveSnapshot(
                    `forex-inr-${pair.code.toLowerCase()}`, 'forex', 'exchangerate', 'India', pair.code,
                    rate, { base: 'INR', target: pair.code, time_last_update: response.data.time_last_update_utc }
                );
                console.log(`  ✅ 1 INR = ${rate} ${pair.code}`);
            }
        }
    } catch (error) {
        console.error('❌ Forex fetch error:', error.message);
    }
};

// ═══════════════════════════════════════════
// 🚀 MASTER FETCH (called on startup only)
// ═══════════════════════════════════════════
const fetchAll = async () => {
    console.log('🔄 Fetching all sources...');
    console.log(`🛡️ Max snapshots per dataset: ${MAX_SNAPSHOTS_PER_DATASET}`);

    console.log('\n📈 Crypto (Top 10):');
    await fetchAllCrypto();

    console.log('\n🌫️ Air Quality (10 Indian Cities):');
    await fetchAllAQI();

    console.log('\n🌡️ Weather (10 Indian Cities):');
    await fetchAllWeather();

    console.log('\n💱 Forex (5 pairs vs INR):');
    await fetchAllForex();

    console.log('\n✅ All fetches complete.');
};

// ── Single dataset fetcher (for fetch-now) ──
const fetchSingleDataset = async (datasetName) => {
    const cryptoMatch = CRYPTOS.find(c => `crypto-${c.id}` === datasetName);
    if (cryptoMatch) {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoMatch.id}&vs_currencies=inr,usd`);
        const priceINR = response.data[cryptoMatch.id]?.inr;
        const priceUSD = response.data[cryptoMatch.id]?.usd;
        if (priceINR) await saveSnapshot(`crypto-${cryptoMatch.id}`, 'crypto', 'coingecko', 'India', 'INR', priceINR, { symbol: cryptoMatch.symbol, usd: priceUSD, inr: priceINR });
        return true;
    }

    const aqiMatch = INDIAN_CITIES.find(c => `aqi-${c.name.toLowerCase()}` === datasetName);
    if (aqiMatch) {
        const token = process.env.WAQI_API_TOKEN || 'demo';
        const response = await axios.get(`https://api.waqi.info/feed/${aqiMatch.waqiSlug}/?token=${token}`);
        if (response.data.status === 'ok') {
            const pm25 = response.data.data.iaqi?.pm25?.v;
            const aqi = response.data.data.aqi;
            await saveSnapshot(`aqi-${aqiMatch.name.toLowerCase()}`, 'air_quality', 'waqi', `${aqiMatch.name}, India`, 'μg/m³', pm25 || aqi, { aqi, pm25 });
        }
        return true;
    }

    const weatherMatch = INDIAN_CITIES.find(c => `weather-${c.name.toLowerCase()}` === datasetName);
    if (weatherMatch) {
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${weatherMatch.lat}&longitude=${weatherMatch.lon}&current_weather=true`);
        const temp = response.data.current_weather.temperature;
        await saveSnapshot(`weather-${weatherMatch.name.toLowerCase()}`, 'weather', 'open-meteo', `${weatherMatch.name}, India`, '°C', temp, response.data.current_weather);
        return true;
    }

    const forexMatch = FOREX_PAIRS.find(p => `forex-inr-${p.code.toLowerCase()}` === datasetName);
    if (forexMatch) {
        const response = await axios.get('https://open.er-api.com/v6/latest/INR');
        const rate = response.data.rates[forexMatch.code];
        if (rate) await saveSnapshot(`forex-inr-${forexMatch.code.toLowerCase()}`, 'forex', 'exchangerate', 'India', forexMatch.code, rate, { base: 'INR', target: forexMatch.code });
        return true;
    }

    return false;
};

module.exports = { fetchAll, fetchAllCrypto, fetchAllAQI, fetchAllWeather, fetchAllForex, fetchSingleDataset, CRYPTOS, INDIAN_CITIES, FOREX_PAIRS };
