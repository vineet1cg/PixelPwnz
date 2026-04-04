const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const Event = require('../models/Event');
const { generatePredictiveForecast } = require('./aiService');

const runForecastCycle = async () => {
    console.log('\n🔮 [AI Forecaster] Starting Predictive Forecast Cycle...');
    const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
    try {
        const datasets = await Dataset.find({});
        for (const ds of datasets) {
            // Get last 24 snapshots
            const snapshots = await Snapshot.find({ dataset_id: ds._id })
                .sort({ timestamp: -1 })
                .limit(24);
            
            if (snapshots.length < 5) continue; // Not enough data
            
            // Reverse so they are chronological for the AI prompt
            snapshots.reverse();
            
            const forecast = await generatePredictiveForecast(ds, snapshots);
            
            // Wait 4 seconds to gracefully respect AI API rate limits (avoiding 429 Too Many Requests)
            await sleep(4000);
            
            // Validate the prediction constraint
            if (forecast && forecast.has_prediction && forecast.confidence_level >= 75) {
                // Check if we already predicted something similar recently to prevent duplicate spamming
                const recentPred = await Event.findOne({
                    dataset_id: ds._id,
                    type: 'prediction',
                    timestamp: { $gte: new Date(Date.now() - 4 * 60 * 60 * 1000) } // 4 hours timeout
                });
                
                if (recentPred) {
                    console.log(`  ⏭️ Skipped prediction for ${ds.name} (Recent prophecy already active)`);
                    continue;
                }

                const currentSnap = snapshots[snapshots.length - 1];
                const pct = Math.abs(forecast.estimated_percentage_change);
                const projectedVal = currentSnap.value * (1 + (forecast.type === 'drop' ? -pct : pct) / 100);
                
                const targetDate = new Date(Date.now() + (forecast.hours_until_occurrence || 12) * 60 * 60 * 1000);
                
                await Event.create({
                    dataset_id: ds._id,
                    type: 'prediction',
                    percentage_change: forecast.type === 'drop' ? -pct : pct,
                    previous_value: currentSnap.value,
                    current_value: projectedVal,
                    timestamp: new Date(),
                    target_timestamp: targetDate,
                    message: `Forecast: A ${pct.toFixed(2)}% ${forecast.type} is predicted in roughly ${forecast.hours_until_occurrence || 12} hours.`,
                    severity: forecast.confidence_level >= 90 ? 'high' : 'medium',
                    is_significant: true,
                    ai_reason: forecast.reasoning,
                    ai_confidence: forecast.confidence_level
                });
                console.log(`  🔮 Generated Prediction for ${ds.name} — ${pct}% ${forecast.type.toUpperCase()}`);
            }
        }
        console.log('🔮 [AI Forecaster] Forecast Cycle Complete.\n');
    } catch (error) {
        console.error('Failed to run forecast cycle:', error);
    }
};

module.exports = { runForecastCycle };
