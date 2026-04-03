const express = require('express');
const router = express.Router({ mergeParams: true });
const { getSnapshotsForDataset, exportSnapshotsCSV } = require('../controllers/snapshotController');

// PRD: GET /api/datasets/:id/snapshots?from=&to=
router.get('/:id/snapshots', getSnapshotsForDataset);

// PRD: GET /api/datasets/:id/export (CSV export)
router.get('/:id/export', exportSnapshotsCSV);

module.exports = router;
