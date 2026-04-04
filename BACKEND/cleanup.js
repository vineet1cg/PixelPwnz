require('dotenv').config();
const mongoose = require('mongoose');
const Dataset = require('./models/Dataset');
const Snapshot = require('./models/Snapshot');
const Event = require('./models/Event');

const cleanupDB = async () => {
    const remoteUri = (process.env.MONGO_URI || '').trim();
    const localUri = 'mongodb://127.0.0.1:27017/datatime';

    console.log('\n🧹 Database Cleanup Tool\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Clean Remote (Atlas) if available
    if (remoteUri) {
        console.log('📡 Attempting Remote MongoDB (Atlas)...');
        try {
            await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 5000 });
            console.log('   ✅ Connected\n');

            console.log('   🗑️  Clearing collections...');
            const datasetDeleted = await Dataset.deleteMany({});
            const snapshotDeleted = await Snapshot.deleteMany({});
            const eventDeleted = await Event.deleteMany({});

            console.log(`   ✅ Deleted ${datasetDeleted.deletedCount} datasets`);
            console.log(`   ✅ Deleted ${snapshotDeleted.deletedCount} snapshots`);
            console.log(`   ✅ Deleted ${eventDeleted.deletedCount} events`);

            await mongoose.disconnect();
            console.log('   ✅ Disconnected\n');
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}\n`);
        }
    }

    // Clean Local
    console.log('🏠 Cleaning Local MongoDB...');
    try {
        await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        console.log('   ✅ Connected\n');

        console.log('   🗑️  Clearing collections...');
        const datasetDeleted = await Dataset.deleteMany({});
        const snapshotDeleted = await Snapshot.deleteMany({});
        const eventDeleted = await Event.deleteMany({});

        console.log(`   ✅ Deleted ${datasetDeleted.deletedCount} datasets`);
        console.log(`   ✅ Deleted ${snapshotDeleted.deletedCount} snapshots`);
        console.log(`   ✅ Deleted ${eventDeleted.deletedCount} events`);

        await mongoose.disconnect();
        console.log('   ✅ Disconnected\n');

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✨ Both databases cleaned. Ready for fresh seed!\n');
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        process.exit(1);
    }
};

cleanupDB();
