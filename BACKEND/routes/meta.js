const express = require('express');
const Snapshot = require('../models/Snapshot');
const { runForecastCycle } = require('../services/forecaster');

const router = express.Router();

/**
 * GET /api/meta/time-bounds
 * Min/max snapshot timestamps across all datasets — one indexed aggregation.
 */
router.get('/time-bounds', async (req, res) => {
    try {
        const rows = await Snapshot.aggregate([
            {
                $group: {
                    _id: null,
                    minTimestamp: { $min: '$timestamp' },
                    maxTimestamp: { $max: '$timestamp' },
                    count: { $sum: 1 },
                },
            },
        ]);

        if (!rows.length || rows[0].count === 0) {
            return res.json({
                minTimestamp: null,
                maxTimestamp: null,
                count: 0,
            });
        }

        const { minTimestamp, maxTimestamp, count } = rows[0];
        res.json({
            minTimestamp: minTimestamp.toISOString(),
            maxTimestamp: maxTimestamp.toISOString(),
            count,
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

/**
 * POST /api/meta/trigger-forecast
 * Manually starts the AI forecasting loop
 */
router.post('/trigger-forecast', async (req, res) => {
    try {
        // Run asynchronously so we don't block the request entirely
        runForecastCycle().catch((err) => console.error('Manual forecast failed:', err));
        res.json({ message: 'Forecast cycle triggered and running in the background!' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
