const express = require('express');
const router = express.Router();
const { fetchNow } = require('../controllers/datasetController');

// PRD: POST /api/fetch-now/:id
router.post('/:id', fetchNow);

module.exports = router;