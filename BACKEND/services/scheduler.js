const cron = require('node-cron');
const { fetchAllCrypto, fetchAllAQI, fetchAllWeather, fetchAllForex } = require('./fetcher');

// ═══════════════════════════════════════════
// Custom cron intervals per API rate limit:
//
// API             Free Limit         Interval    Fetches/day
// ─────────────────────────────────────────────────────────
// CoinGecko       30 calls/min       10 min      144 calls (1 batch = 1 call)
// WAQI            1000 req/day       15 min      10 cities × 96 = 960
// Open-Meteo      10,000 req/day     10 min      10 cities × 144 = 1440
// ExchangeRate    Updates 1x/day     60 min      24 calls (all rates in 1 call)
// ═══════════════════════════════════════════

const startScheduler = () => {
    // 📈 Crypto — every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Crypto...');
        await fetchAllCrypto();
    });

    // 🌫️ AQI — every 15 minutes (stay under 1000/day limit)
    cron.schedule('*/15 * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching AQI...');
        await fetchAllAQI();
    });

    // 🌡️ Weather — every 10 minutes
    cron.schedule('*/10 * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Weather...');
        await fetchAllWeather();
    });

    // 💱 Forex — every 60 minutes (data only updates once/day anyway)
    cron.schedule('0 * * * *', async () => {
        console.log('\n⏰ [Cron] Fetching Forex...');
        await fetchAllForex();
    });

    console.log('Scheduler started with custom intervals:');
    console.log('  📈 Crypto:  every 10 min');
    console.log('  🌫️ AQI:     every 15 min');
    console.log('  🌡️ Weather: every 10 min');
    console.log('  💱 Forex:   every 60 min');
};

module.exports = { startScheduler };
