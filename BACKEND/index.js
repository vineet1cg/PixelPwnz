require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { fetchAll } = require('./services/fetcher');
const { startScheduler } = require('./services/scheduler');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// Connect to Databasewtf 
connectDB();

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health Check Route
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'Server is healthy', timestamp: new Date() });
});

// API Routes (PRD endpoints)
app.use('/api/datasets', require('./routes/datasets'));       // GET /api/datasets, POST /api/datasets
app.use('/api/datasets', require('./routes/snapshots'));       // GET /api/datasets/:id/snapshots, GET /api/datasets/:id/export
app.use('/api', require('./routes/events'));                   // GET /api/events, GET /api/datasets/:id/events, GET /api/events/:id/explain
app.use('/api/fetch-now', require('./routes/fetchNow'));       // POST /api/fetch-now/:id

// Global Error Handler
app.use(errorHandler);

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
