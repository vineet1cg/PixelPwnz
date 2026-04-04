require('dotenv').config();
const express = require('express');
const cors = require('cors');
const connectDB = require('./config/db');
const { startScheduler } = require('./services/scheduler');
const { errorHandler } = require('./utils/errorHandler');

const app = express();

// Middleware
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : ['http://localhost:3000', 'http://localhost:5173'];
app.use(cors({ origin: allowedOrigins }));
app.use(express.json());

// Health Check Route with seeding status
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'Server is healthy',
        timestamp: new Date(),
        seeding: global.seedingStatus || { inProgress: false, progress: 0 }
    });
});

// API Routes (PRD endpoints)
app.use('/api/auth', require('./routes/auth'));               // POST /api/auth/signup, POST /api/auth/login, GET /api/auth/me
app.use('/api/meta', require('./routes/meta'));               // GET /api/meta/time-bounds
app.use('/api/datasets', require('./routes/datasets'));       // GET /api/datasets, POST /api/datasets
app.use('/api/datasets', require('./routes/snapshots'));      // GET /api/datasets/:id/snapshots, GET /api/datasets/:id/export
app.use('/api', require('./routes/events'));                  // GET /api/events, GET /api/datasets/:id/events, GET /api/events/:id/explain, POST /api/events/:id/flag
app.use('/api/fetch-now', require('./routes/fetchNow'));      // POST /api/fetch-now/:id

// Global Error Handler
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

// ══════════════════════════════════════════════════════════════
// STARTUP: Listen immediately, then handle DB & seeding in background
// ══════════════════════════════════════════════════════════════
const server = app.listen(PORT, () => {
    console.log(`\n✅ Server ready on port ${PORT}`);
    console.log(`   Health check: http://localhost:${PORT}/health`);
    console.log(`   Frontend: http://localhost:5173\n`);
});

// Initialize DB and seeding in background (non-blocking)
(async () => {
    try {
        global.seedingStatus = { inProgress: true, progress: 5, phase: 'connecting', error: null };
        console.log('🔄 Database initialization starting in background...');
        
        await connectDB();
        
        global.seedingStatus = { inProgress: true, progress: 95, phase: 'starting-scheduler', error: null };
        console.log('🚀 Starting data scheduler...');
        startScheduler();
        
        global.seedingStatus = { inProgress: false, progress: 100, phase: 'complete', error: null, completedAt: new Date() };
        console.log('✨ All systems ready! Data available at /api/datasets');
    } catch (err) {
        console.error('❌ Background initialization error:', err.message);
        global.seedingStatus = { inProgress: false, progress: 0, phase: 'error', error: err.message };
    }
})();
