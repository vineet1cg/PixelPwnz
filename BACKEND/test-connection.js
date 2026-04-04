require('dotenv').config();
const mongoose = require('mongoose');

const testConnection = async () => {
    const remoteUri = (process.env.MONGO_URI || '').trim();
    const localUri = 'mongodb://127.0.0.1:27017/datatime';

    console.log('🧪 Testing MongoDB Connection\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Test Remote
    if (remoteUri) {
        console.log('📡 Remote MongoDB Test:');
        console.log(`   URI: ${remoteUri.substring(0, 50)}...`);
        try {
            const conn = await mongoose.connect(remoteUri, { serverSelectionTimeoutMS: 5000 });
            console.log(`   ✅ Connected to: ${conn.connection.host}:${conn.connection.port}`);
            console.log(`   ✅ Database: ${conn.connection.name}`);
            await mongoose.disconnect();
            console.log('   ✅ Disconnected gracefully\n');
            return;
        } catch (error) {
            console.log(`   ❌ Failed: ${error.message}\n`);
        }
    }

    // Test Local
    console.log('🏠 Local MongoDB Test:');
    console.log(`   URI: ${localUri}`);
    try {
        const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 5000 });
        console.log(`   ✅ Connected to: ${conn.connection.host}:${conn.connection.port}`);
        console.log(`   ✅ Database: ${conn.connection.name}`);

        // Get collection stats
        const adminDb = conn.connection.getClient().db('datatime').admin();
        const dbStats = await adminDb.stats();
        console.log(`   ✅ Collections: ${dbStats.collections}`);
        console.log(`   ✅ Data size: ${(dbStats.dataSize / 1024 / 1024).toFixed(2)} MB`);

        await mongoose.disconnect();
        console.log('   ✅ Disconnected gracefully\n');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('🎉 Connection test PASSED!\n');
    } catch (error) {
        console.log(`   ❌ Failed: ${error.message}\n`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('❌ Connection test FAILED!\n');
        console.log('💡 TIP: Make sure MongoDB is running locally:');
        console.log('   Windows: Start MongoDB service or run mongod.exe');
        console.log('   Mac/Linux: Run: mongod\n');
        process.exit(1);
    }
};

testConnection();
