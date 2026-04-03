require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { fetchAll } = require('./services/fetcher');
const { startScheduler } = require('./services/scheduler');

const app = express();

// Connect to Database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Main Route
app.get('/', (req, res) => {
    res.send('API is running...');
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, async () => {
    console.log(`Server running on port ${PORT}`);
    
    try {
        console.log('Performing initial data fetch...');
        await fetchAll();
        startScheduler();
    } catch(err) {
        console.error('Error during initial fetch:', err.message);
    }
});
