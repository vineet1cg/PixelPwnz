const cron = require('node-cron');
const { fetchAllCrypto, fetchAllAQI, fetchAllWeather, fetchAllForex } = require('./fetcher');

// ═══════════════════════════════════════════
// Custom cron intervals (Updated to 1 minute per user request)
// ═══════════════════════════════════════════

const startScheduler = () => {
    // 📈 Crypto — every 1 minute
    cron.schedule('* * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Crypto...');
        await fetchAllCrypto();
    });

    // 🌫️ AQI — every 1 minute
    cron.schedule('* * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching AQI...');
        await fetchAllAQI();
    });

    // 🌡️ Weather — every 1 minute
    cron.schedule('* * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Weather...');
        await fetchAllWeather();
    });

    // 💱 Forex — every 60 minutes (data only updates once/day anyway)
    cron.schedule('0 * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Forex...');
        await fetchAllForex();
    });

    console.log('Scheduler started with custom intervals:');
    console.log('  📈 Crypto:  every 1 min');
    console.log('  🌫️ AQI:     every 1 min');
    console.log('  🌡️ Weather: every 1 min');
    console.log('  💱 Forex:   every 60 min');
};

module.exports = { startScheduler };
