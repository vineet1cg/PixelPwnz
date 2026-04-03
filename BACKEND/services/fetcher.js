const axios = require('axios');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const { detectChange } = require('./changeDetection');

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

// ── Top 10 Indian Cities (WAQI + Open-Meteo) ──
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

// ── Save Snapshot Helper ──
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
    return snapshot;
};

// ══════════════════════════════════════
// CRYPTO FETCHERS — CoinGecko (no key)
// ══════════════════════════════════════
const fetchAllCrypto = async () => {
    try {
        const ids = CRYPTOS.map(c => c.id).join(',');
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`);

        for (const crypto of CRYPTOS) {
            const price = response.data[crypto.id]?.usd;
            if (price !== undefined) {
                await saveSnapshot(
                    `crypto-${crypto.id}`,
                    'crypto',
                    'coingecko',
                    'global',
                    'USD',
                    price,
                    { symbol: crypto.symbol, raw: response.data[crypto.id] }
                );
                console.log(`  ✅ ${crypto.name} (${crypto.symbol}): $${price}`);
            }
        }
    } catch (error) {
        console.error('❌ Error fetching crypto data:', error.message);
    }
};

// ══════════════════════════════════════
// AQI FETCHERS — WAQI (free demo token)
// ══════════════════════════════════════
const fetchAllAQI = async () => {
    for (const city of INDIAN_CITIES) {
        try {
            const response = await axios.get(`https://api.waqi.info/feed/${city.waqiSlug}/?token=demo`);
            if (response.data.status !== 'ok') {
                console.warn(`  ⚠️ WAQI ${city.name}: non-ok status`);
                continue;
            }
            const pm25 = response.data.data.iaqi?.pm25?.v;
            const aqi = response.data.data.aqi;
            const value = pm25 || aqi;

            await saveSnapshot(
                `aqi-${city.name.toLowerCase()}`,
                'air_quality',
                'openaq',
                `${city.name}, India`,
                'μg/m³',
                value,
                { aqi, pm25, dominentpol: response.data.data.dominentpol, time: response.data.data.time }
            );
            console.log(`  ✅ ${city.name} AQI: ${value} μg/m³ (AQI: ${aqi})`);
        } catch (error) {
            console.error(`  ❌ Error fetching AQI for ${city.name}:`, error.message);
        }
    }
};

// ══════════════════════════════════════
// WEATHER FETCHERS — Open-Meteo (no key)
// ══════════════════════════════════════
const fetchAllWeather = async () => {
    for (const city of INDIAN_CITIES) {
        try {
            const response = await axios.get(
                `https://api.open-meteo.com/v1/forecast?latitude=${city.lat}&longitude=${city.lon}&current_weather=true`
            );
            const value = response.data.current_weather.temperature;

            await saveSnapshot(
                `weather-${city.name.toLowerCase()}`,
                'weather',
                'openweather',
                `${city.name}, India`,
                '°C',
                value,
                response.data.current_weather
            );
            console.log(`  ✅ ${city.name} Temp: ${value}°C`);
        } catch (error) {
            console.error(`  ❌ Error fetching weather for ${city.name}:`, error.message);
        }
    }
};

// ══════════════════════════════════════
// MASTER FETCH
// ══════════════════════════════════════
const fetchAll = async () => {
    console.log('🔄 Fetching all sources...');

    console.log('\n📈 Crypto (Top 10):');
    await fetchAllCrypto();

    console.log('\n🌫️ Air Quality (Top 10 Indian Cities):');
    await fetchAllAQI();

    console.log('\n🌡️ Weather (Top 10 Indian Cities):');
    await fetchAllWeather();

    console.log('\n✅ All fetches complete.');
};

// ── Individual fetchers (for fetch-now by dataset name) ──
const fetchSingleDataset = async (datasetName) => {
    // Crypto
    const cryptoMatch = CRYPTOS.find(c => `crypto-${c.id}` === datasetName);
    if (cryptoMatch) {
        const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cryptoMatch.id}&vs_currencies=usd`);
        const price = response.data[cryptoMatch.id]?.usd;
        if (price !== undefined) {
            await saveSnapshot(`crypto-${cryptoMatch.id}`, 'crypto', 'coingecko', 'global', 'USD', price, { symbol: cryptoMatch.symbol });
        }
        return true;
    }

    // AQI
    const aqiMatch = INDIAN_CITIES.find(c => `aqi-${c.name.toLowerCase()}` === datasetName);
    if (aqiMatch) {
        const response = await axios.get(`https://api.waqi.info/feed/${aqiMatch.waqiSlug}/?token=demo`);
        if (response.data.status === 'ok') {
            const pm25 = response.data.data.iaqi?.pm25?.v;
            const aqi = response.data.data.aqi;
            await saveSnapshot(`aqi-${aqiMatch.name.toLowerCase()}`, 'air_quality', 'openaq', `${aqiMatch.name}, India`, 'μg/m³', pm25 || aqi, { aqi, pm25 });
        }
        return true;
    }

    // Weather
    const weatherMatch = INDIAN_CITIES.find(c => `weather-${c.name.toLowerCase()}` === datasetName);
    if (weatherMatch) {
        const response = await axios.get(`https://api.open-meteo.com/v1/forecast?latitude=${weatherMatch.lat}&longitude=${weatherMatch.lon}&current_weather=true`);
        const temp = response.data.current_weather.temperature;
        await saveSnapshot(`weather-${weatherMatch.name.toLowerCase()}`, 'weather', 'openweather', `${weatherMatch.name}, India`, '°C', temp, response.data.current_weather);
        return true;
    }

    return false;
};

module.exports = { fetchAll, fetchAllCrypto, fetchAllAQI, fetchAllWeather, fetchSingleDataset, CRYPTOS, INDIAN_CITIES };
