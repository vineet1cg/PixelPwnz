const generateEventExplanation = async (event) => {
    // Mocking an AI generation
    return `AI Investigation: The ${event.type} event showed a change of ${event.percentage_change.toFixed(2)}%. This was likely caused by external market or environmental fluctuations. The current value is ${event.current_value}.`;
};

module.exports = { generateEventExplanation };
