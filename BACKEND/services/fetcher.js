const axios = require('axios');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const { detectChange } = require('./changeDetection');

const saveSnapshot = async (datasetName, category, sourceApi, location, value) => {
    let dataset = await Dataset.findOne({ name: datasetName });
    if (!dataset) {
        dataset = await Dataset.create({
            name: datasetName,
            category,
            source_api: sourceApi,
            location
        });
    }

    const snapshot = await Snapshot.create({
        dataset_id: dataset._id,
        value
    });

    await detectChange(snapshot);
};

const fetchBitcoin = async () => {
    try {
        const response = await axios.get('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd');
        const value = response.data.bitcoin.usd;
        await saveSnapshot('Bitcoin Price', 'Finance', 'CoinGecko API', 'Global', value);
        console.log(`Fetched Bitcoin: $${value}`);
    } catch (error) {
        console.error('Error fetching Bitcoin data:', error.message);
    }
};

const fetchDelhiAQI = async () => {
    try {
        const response = await axios.get('https://api.waqi.info/feed/delhi/?token=demo');
        const value = response.data.data.aqi;
        await saveSnapshot('Delhi AQI', 'Environment', 'WAQI API', 'Delhi, India', value);
        console.log(`Fetched Delhi AQI: ${value}`);
    } catch (error) {
        console.error('Error fetching Delhi AQI data:', error.message);
    }
};

const fetchMumbaiWeather = async () => {
    try {
        const response = await axios.get('https://api.open-meteo.com/v1/forecast?latitude=19.0760&longitude=72.8777&current_weather=true');
        const value = response.data.current_weather.temperature;
        await saveSnapshot('Mumbai Temperature', 'Weather', 'Open-Meteo API', 'Mumbai, India', value);
        console.log(`Fetched Mumbai Weather: ${value}°C`);
    } catch (error) {
        console.error('Error fetching Mumbai Weather data:', error.message);
    }
};

const fetchAll = async () => {
    console.log('Fetching all sources...');
    await fetchBitcoin();
    await fetchDelhiAQI();
    await fetchMumbaiWeather();
};

module.exports = { fetchAll, fetchBitcoin, fetchDelhiAQI, fetchMumbaiWeather };
