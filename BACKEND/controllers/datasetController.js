const Dataset = require('../models/Dataset');
const { fetchBitcoin, fetchDelhiAQI, fetchMumbaiWeather } = require('../services/fetcher');

const getDatasets = async (req, res) => {
    try {
        const datasets = await Dataset.find();
        res.json(datasets);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const createDataset = async (req, res) => {
    try {
        const dataset = await Dataset.create(req.body);
        res.status(201).json(dataset);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

const fetchNow = async (req, res) => {
    try {
        const dataset = await Dataset.findById(req.params.id);
        if (!dataset) return res.status(404).json({ error: 'Dataset not found' });
        
        let fetched = false;
        
        if (dataset.name === 'bitcoin') {
            await fetchBitcoin();
            fetched = true;
        } else if (dataset.name === 'pm25-delhi') {
            await fetchDelhiAQI();
            fetched = true;
        } else if (dataset.name === 'mumbai-temp') {
            await fetchMumbaiWeather();
            fetched = true;
        }
        
        if(fetched) {
            res.json({ message: 'Manual fetch completed for ' + dataset.name });
        } else {
            res.status(400).json({ error: 'No fetcher available for this dataset' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getDatasets, createDataset, fetchNow };
