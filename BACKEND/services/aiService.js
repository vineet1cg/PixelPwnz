const axios = require('axios');
const Dataset = require('../models/Dataset');

const generateEventExplanation = async (event) => {
    try {
        // Retrieve the dataset to provide context to the AI
        const dataset = await Dataset.findById(event.dataset_id);
        
        const context = dataset ? 
            `${dataset.name} (${dataset.category}) located in ${dataset.location}. The unit of measurement is ${dataset.unit}. ` : 
            'Unknown Dataset. ';

        const prompt = `You are a data analyst for the "DataTime Machine" platform. An anomaly has occurred.
Context: ${context}
Event Date/Time: ${new Date(event.timestamp).toLocaleString()}
Event Type: ${event.type} (Severity: ${event.severity})
Details: The value changed by ${event.percentage_change.toFixed(2)}%, moving from ${event.previous_value} to ${event.current_value}.

Please provide a concise (2-3 sentences), plausible, and factual explanation of what could have caused this particular fluctuation. Make it sound professional but easy to understand. Do not mention that you are an AI.`;

        // Using free open source endpoint (no API key required)
        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [
                { role: 'system', content: 'You are a professional data analyst.' },
                { role: 'user', content: prompt }
            ]
        });

        return response.data;
    } catch (error) {
        console.error('Open Source API Error:', error.message);
        return `Analysis failed: Could not generate explanation at this time. (${error.message})`;
    }
};

module.exports = { generateEventExplanation };
