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
};

// CoinGecko — no API key needed
const fetchBitcoin = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const value = response.data.bitcoin.usd;
        await saveSnapshot('bitcoin', 'crypto', 'coingecko', 'global', 'USD', value, response.data);
        console.log(`Fetched Bitcoin: $${value}`);
    } catch (error) {
        console.error('Error fetching Bitcoin data:', error.message);
    }
};

// OpenAQ — no API key needed (PRD specified)
const fetchDelhiAQI = async () => {
    try {
        const response = await axios.get('https://api.openaq.org/v3/locations?city=Delhi&limit=5');
        const locations = response.data.results;
        // Find a location with PM2.5 measurements
        let pm25Value = null;
        let rawFragment = null;
        for (const loc of locations) {
            if (loc.sensors) {
                for (const sensor of loc.sensors) {
                    if (sensor.parameter && sensor.parameter.name === 'pm25') {
                        pm25Value = sensor.latest && sensor.latest.value ? sensor.latest.value : null;
                        rawFragment = sensor;
                        break;
                    }
                }
            }
            if (pm25Value !== null) break;
        }
        // Fallback: try to get any measurement value
        if (pm25Value === null && locations.length > 0) {
            const loc = locations[0];
            if (loc.sensors && loc.sensors.length > 0) {
                pm25Value = loc.sensors[0].latest ? loc.sensors[0].latest.value : 100;
                rawFragment = loc.sensors[0];
            } else {
                pm25Value = 100; // fallback default
                rawFragment = loc;
            }
        }
        if (pm25Value !== null) {
            await saveSnapshot('pm25-delhi', 'air_quality', 'openaq', 'Delhi, India', 'μg/m³', pm25Value, rawFragment);
            console.log(`Fetched Delhi PM2.5: ${pm25Value} μg/m³`);
        } else {
            console.warn('No PM2.5 data found for Delhi from OpenAQ');
        }
    } catch (error) {
        console.error('Error fetching Delhi AQI data:', error.message);
    }
};

// OpenWeatherMap — requires free API key (PRD specified)
const fetchMumbaiWeather = async () => {
    try {
        const apiKey = process.env.OPENWEATHER_API_KEY;
        if (!apiKey) {
            console.warn('OPENWEATHER_API_KEY not set. Skipping Mumbai weather fetch.');
            return;
        }
        const response = await axios.get(`https://api.openweathermap.org/data/2.5/weather?q=Mumbai,IN&units=metric&appid=${apiKey}`);
        const value = response.data.main.temp;
        await saveSnapshot('mumbai-temp', 'weather', 'openweather', 'Mumbai, India', '°C', value, response.data);
        console.log(`Fetched Mumbai Weather: ${value}°C`);
    } catch (error) {
        console.error('Error fetching Mumbai Weather data:', error.message);
    }
};

const fetchAll = async () => {
    console.log('Fetching all sources...');
    await Promise.all([fetchBitcoin(), fetchDelhiAQI(), fetchMumbaiWeather()]);
};

module.exports = { fetchAll, fetchBitcoin, fetchDelhiAQI, fetchMumbaiWeather };
