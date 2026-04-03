const express = require('express');
const router = express.Router();
const { getDatasets, createDataset } = require('../controllers/datasetController');

router.route('/').get(getDatasets).post(createDataset);

module.exports = router;
