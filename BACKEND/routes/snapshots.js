const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSnapshotsForDataset, exportSnapshotsCSV } = require('../controllers/snapshotController');


router.get('/:id/snapshots', getSnapshotsForDataset);


router.get('/:id/export', exportSnapshotsCSV);

module.exports = router;
