const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSnapshotsForDataset, exportSnapshotsCSV } = require('../controllers/snapshotController');

router.get('/:id/snapshots', getSnapshotsForDataset);
router.get('/:id/snapshots/csv', exportSnapshotsCSV);

module.exports = router;
