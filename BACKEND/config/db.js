const mongoose = require('mongoose');
const Dataset = require('../models/Dataset');
const Snapshot = require('../models/Snapshot');
const Event = require('../models/Event');
const { seedData } = require('../seed');

// Global seeding status for health checks
global.seedingStatus = {
    inProgress: false,
    progress: 0,
    phase: 'idle',
    error: null,
    completedAt: null
};

const connectDB = async () => {
    const remoteUri = (process.env.MONGO_URI || '').trim();
    const localUri = 'mongodb://127.0.0.1:27017/datatime';
    
    // Environment flags
    const SHOULD_CLEAN_DB = process.env.CLEAN_DB !== 'false'; // default: true
    const SHOULD_SEED = process.env.SEED_DATA !== 'false';    // default: true

    if (remoteUri) {
        try {
            console.log(`Attempting to connect to Remote MongoDB...`);
            const conn = await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 10000 });
            console.log(`✅ Remote MongoDB Connected: ${conn.connection.host}`);
            
            if (SHOULD_CLEAN_DB || SHOULD_SEED) {
                if (SHOULD_CLEAN_DB) {
                    console.log('🧹 Cleaning remote database...');
                    global.seedingStatus = { inProgress: true, progress: 10, phase: 'cleaning', error: null };
                    await Dataset.deleteMany({});
                    await Snapshot.deleteMany({});
                    await Event.deleteMany({});
                    console.log('  ✅ Cleared all collections');
                }
                
                if (SHOULD_SEED) {
                    console.log('🌱 Seeding fresh data...');
                    global.seedingStatus = { inProgress: true, progress: 20, phase: 'seeding', error: null };
                    await seedData(false);
                    global.seedingStatus = { inProgress: false, progress: 100, phase: 'complete', error: null, completedAt: new Date() };
                }
            }
            return true;
        } catch (error) {
            console.error(`❌ Remote MongoDB Connection Failed: ${error.message}`);
            console.log('Falling back to local MongoDB...');
        }
    }

    try {
        console.log(`Connecting to Local MongoDB: ${localUri}`);
        const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        console.log(`✅ Local MongoDB Connected: ${conn.connection.host}`);

        if (SHOULD_CLEAN_DB || SHOULD_SEED) {
            if (SHOULD_CLEAN_DB) {
                console.log('🧹 Cleaning local database...');
                global.seedingStatus = { inProgress: true, progress: 10, phase: 'cleaning', error: null };
                const dsDeleted = await Dataset.deleteMany({});
                const snapDeleted = await Snapshot.deleteMany({});
                const evDeleted = await Event.deleteMany({});
                console.log(`  ✅ Cleared ${dsDeleted.deletedCount} datasets, ${snapDeleted.deletedCount} snapshots, ${evDeleted.deletedCount} events`);
            }

            if (SHOULD_SEED) {
                console.log('🌱 Seeding fresh data...');
                global.seedingStatus = { inProgress: true, progress: 20, phase: 'seeding', error: null };
                await seedData(false);
                global.seedingStatus = { inProgress: false, progress: 100, phase: 'complete', error: null, completedAt: new Date() };
            }
        }
        return true;
    } catch (error) {
        global.seedingStatus = { inProgress: false, progress: 0, phase: 'error', error: error.message };
        console.error(`❌ Local MongoDB Connection Failed: ${error.message}`);
        console.log('\n💡 TIP: Make sure MongoDB is running locally (default port 27017).');
        process.exit(1);
    }
};

module.exports = connectDB;
