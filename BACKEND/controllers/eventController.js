const Event = require('../models/Event');
const { generateEventExplanation } = require('../services/aiService');

const getAllEvents = async (req, res) => {
    try {
        const events = await Event.find().sort({ timestamp: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const getEventsForDataset = async (req, res) => {
    try {
        const events = await Event.find({ dataset_id: req.params.id }).sort({ timestamp: -1 });
        res.json(events);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

const explainEvent = async (req, res) => {
    try {
        const event = await Event.findById(req.params.id);
        if (!event) return res.status(404).json({ error: 'Event not found' });
        
        const explanation = await generateEventExplanation(event);
        res.json({ explanation });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

module.exports = { getAllEvents, getEventsForDataset, explainEvent };
