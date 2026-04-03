const cron = require('node-cron');
const { fetchAll } = require('./fetcher');

// Run every 5 minutes
const startScheduler = () => {
    cron.schedule('*/5 * * * *', async () => {
        console.log('Running scheduled data fetch...');
        await fetchAll();
    });
    console.log('Scheduler started. Cron pattern: */5 * * * *');
};

module.exports = { startScheduler };
