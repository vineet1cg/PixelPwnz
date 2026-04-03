const Snapshot = require('../models/Snapshot');

const getSnapshotsForDataset = async (req, res) => {
    const { from, to } = req.query;
    let query = { dataset_id: req.params.id };

    if (from || to) {
        query.timestamp = {};
        if (from) query.timestamp.$gte = new Date(from);
        if (to) query.timestamp.$lte = new Date(to);
    }

    try {
        const snapshots = await Snapshot.find(query).sort({ timestamp: -1 });
        res.json(snapshots);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const exportSnapshotsCSV = async (req, res) => {
    try {
        const snapshots = await Snapshot.find({ dataset_id: req.params.id }).sort({ timestamp: -1 });
        let csv = 'timestamp,value\n';
        snapshots.forEach(s => {
            csv += `${s.timestamp.toISOString()},${s.value}\n`;
        });
        
        res.header('Content-Type', 'text/csv');
        res.attachment(`dataset_${req.params.id}_snapshots.csv`);
        res.send(csv);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getSnapshotsForDataset, exportSnapshotsCSV };
