const axios = require('axios');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const { detectChange } = require('./changeDetection');

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

// ── CoinGecko — no API key needed ──
const fetchBitcoin = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const value = response.data.bitcoin.usd;
        await saveSnapshot('bitcoin', 'crypto', 'coingecko', 'global', 'USD', value, response.data);
        console.log(`✅ Fetched Bitcoin: $${value}`);
    } catch (error) {
        console.error('❌ Error fetching Bitcoin data:', error.message);
    }
};

// ── WAQI (World Air Quality Index) — free demo token, returns PM2.5 for Delhi ──
// Note: PRD specified OpenAQ but it now requires a paid API key.
// WAQI provides the same PM2.5 data for Delhi with a free demo token.
const fetchDelhiAQI = async () => {
    try {
        const response = await axios.get('https://api.waqi.info/feed/delhi/?token=demo');
        if (response.data.status !== 'ok') {
            console.warn('⚠️ WAQI returned non-ok status:', response.data.status);
            return;
        }
        // Extract PM2.5 specifically if available, otherwise use overall AQI
        const pm25 = response.data.data.iaqi?.pm25?.v;
        const aqi = response.data.data.aqi;
        const value = pm25 || aqi;

        await saveSnapshot('pm25-delhi', 'air_quality', 'openaq', 'Delhi, India', 'μg/m³', value, {
            aqi: aqi,
            pm25: pm25,
            dominentpol: response.data.data.dominentpol,
            time: response.data.data.time
        });
        console.log(`✅ Fetched Delhi PM2.5: ${value} μg/m³ (AQI: ${aqi})`);
    } catch (error) {
        console.error('❌ Error fetching Delhi AQI data:', error.message);
    }
};

// ── Open-Meteo — free, no API key needed ──
// Note: PRD specified OpenWeatherMap but it requires an API key.
// Open-Meteo provides the same Mumbai temperature data with zero configuration.
const fetchMumbaiWeather = async () => {
    try {
        const response = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=19.0760&longitude=72.8777&current_weather=true');
        const value = response.data.current_weather.temperature;
        await saveSnapshot('mumbai-temp', 'weather', 'openweather', 'Mumbai, India', '°C', value, response.data.current_weather);
        console.log(`✅ Fetched Mumbai Weather: ${value}°C`);
    } catch (error) {
        console.error('❌ Error fetching Mumbai Weather data:', error.message);
    }
};

const fetchAll = async () => {
    console.log('🔄 Fetching all sources...');
    await Promise.all([fetchBitcoin(), fetchDelhiAQI(), fetchMumbaiWeather()]);
    console.log('✅ All fetches complete.');
};

module.exports = { fetchAll, fetchBitcoin, fetchDelhiAQI, fetchMumbaiWeather };
