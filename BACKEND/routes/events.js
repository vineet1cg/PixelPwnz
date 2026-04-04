const express = require('express');
const router = express.Router();
const {
    getAllEvents,
    getEventsForDataset,
    getFlaggedEvents,
    explainEvent,
    flagEvent
} = require('../controllers/eventController');
const { requireAuth, optionalAuth } = require('../middlewares/authMiddleware');

router.get('/events', optionalAuth, getAllEvents);
router.get('/events/flagged', requireAuth, getFlaggedEvents);
router.post('/events/:id/flag', requireAuth, flagEvent);
router.get('/events/:id/explain', optionalAuth, explainEvent);
router.get('/datasets/:id/events', optionalAuth, getEventsForDataset);

module.exports = router;
