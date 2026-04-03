const express = require('express');
const router = express.Router();
const { getAllEvents, getEventsForDataset, explainEvent } = require('../controllers/eventController');

router.get('/events', getAllEvents);
router.get('/events/:id/explain', explainEvent);
router.get('/datasets/:id/events', getEventsForDataset);

module.exports = router;
