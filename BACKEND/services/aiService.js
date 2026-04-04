const axios = require('axios');
const Dataset = require('../models/Dataset');

// Determine if a change is significant based on severity and threshold
const isSignificantChange = (severity, percentageChange) => {
    return severity === 'high' || (severity === 'medium' && Math.abs(percentageChange) > 15);
};

// Enhanced function for comprehensive event analysis with 3-part breakdown
const generateComprehensiveExplanation = async (event) => {
    try {
        const dataset = await Dataset.findById(event.dataset_id);
        const context = dataset ? 
            `${dataset.name} (${dataset.category}) located in ${dataset.location}. The unit of measurement is ${dataset.unit}. ` : 
            'Unknown Dataset. ';

        const prompt = `You are a data analyst for the "DataTime Machine" platform, specializing in time-series anomaly analysis.

Context: ${context}
Event Date/Time: ${new Date(event.timestamp).toLocaleString()}
Event Type: ${event.type} (Severity: ${event.severity})
Change: The value changed by ${event.percentage_change.toFixed(2)}%, moving from ${event.previous_value} to ${event.current_value}.

Please provide a structured JSON response with EXACTLY these three fields (no additional fields):
1. "reason": A 1-2 sentence explanation of what likely caused this specific change. Be factual and plausible.
2. "action": A 1-2 sentence recommendation on what action should be taken in response to this event.
3. "impact": A 1-2 sentence explanation of potential future impacts or implications if this trend continues.

IMPORTANT: Respond ONLY with valid JSON in this exact format, no markdown, no extra text:
{"reason": "...", "action": "...", "impact": "..."}`;

        let response = null;

        // Try Groq API first (fastest)
        if (process.env.GROQ_API_KEY) {
            try {
                const groqResponse = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'llama-3.1-8b-instant',
                        messages: [
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.7,
                        max_tokens: 300
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 10000
                    }
                );
                response = groqResponse.data.choices[0].message.content;
            } catch (grErr) {
                console.log('Groq API failed, falling back to Pollinations:', grErr.message);
            }
        }

        // Fallback: Pollinations API (free, no key)
        if (!response) {
            const pollResponse = await axios.post(
                'https://text.pollinations.ai/',
                {
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                },
                { timeout: 15000 }
            );
            response = pollResponse.data;
        }

        // Parse the JSON response
        try {
            const parsed = JSON.parse(response);
            if (parsed.reason && parsed.action && parsed.impact) {
                return parsed;
            }
        } catch (parseErr) {
            // If parsing fails, return a safe default
            console.warn('Failed to parse AI response as JSON:', response.substring(0, 100));
        }

        // Fallback response structure
        return {
            reason: 'Unable to generate analysis at this time.',
            action: 'Please review the data manually for context.',
            impact: 'Monitor this metric for further changes.'
        };
    } catch (error) {
        console.error('AI Service Error:', error.message);
        return {
            reason: `Analysis failed: ${error.message}`,
            action: 'Retry or review manually.',
            impact: 'Data integrity maintained despite analysis failure.'
        };
    }
};

// Legacy function for backward compatibility
const generateEventExplanation = async (event) => {
    try {
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

        if (process.env.GROQ_API_KEY) {
            const groqResponse = await axios.post(
                'https://api.groq.com/openai/v1/chat/completions',
                {
                    model: 'llama-3.1-8b-instant',
                    messages: [
                        { role: 'user', content: prompt }
                    ]
                },
                {
                    headers: {
                        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                        'Content-Type': 'application/json'
                    }
                }
            );
            return groqResponse.data.choices[0].message.content;
        }

        const response = await axios.post('https://text.pollinations.ai/', {
            messages: [
                { role: 'system', content: 'You are a professional data analyst.' },
                { role: 'user', content: prompt }
            ]
        });

        return response.data;
    } catch (error) {
        console.error('AI Service Error:', error.message);
        return `Analysis failed: Could not generate explanation at this time. (${error.message})`;
    }
};

// Predictive Analytics Pipeline
const generatePredictiveForecast = async (dataset, snapshots) => {
    try {
        // take last 24 items if there are too many
        const recentSnapshots = snapshots.slice(-24);
        const historyData = recentSnapshots.map(s => `${new Date(s.timestamp).toLocaleTimeString()}: ${s.value}`).join('\n');
        
        const context = dataset ? 
            `${dataset.name} (${dataset.category}) located in ${dataset.location}. Unit: ${dataset.unit}.` : 
            'Unknown Dataset.';

        const prompt = `You are a strict data scientist algorithmic forecaster.
Analyze the following recent temporal data points for anomalies and predict if a massive sudden event (drop or spike > 10%) is about to occur within the next 24 hours.

Context: ${context}
Recent History:
${historyData}

Return a single JSON object with EXACTLY these fields (No markdown, no explanation, just raw JSON):
{
  "has_prediction": true,
  "type": "spike",
  "confidence_level": 85,
  "estimated_percentage_change": 15.5,
  "reasoning": "Based on the sharp acceleration in the last 3 hours, a continuing trend suggests a breakout constraint...",
  "hours_until_occurrence": 6
}
If you do NOT predict an event, return {"has_prediction": false, "confidence_level": 0}`;

        let response = null;

        if (process.env.GROQ_API_KEY) {
            try {
                const groqResponse = await axios.post(
                    'https://api.groq.com/openai/v1/chat/completions',
                    {
                        model: 'llama-3.1-8b-instant',
                        response_format: { type: "json_object" },
                        messages: [
                            { role: 'user', content: prompt }
                        ],
                        temperature: 0.3
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
                            'Content-Type': 'application/json'
                        },
                        timeout: 15000
                    }
                );
                response = groqResponse.data.choices[0].message.content;
            } catch (gErr) {
                console.log('Groq Forecasting API failed, falling back to Pollinations:', gErr.message);
            }
        }
        
        if (!response) {
            const pxResponse = await axios.post('https://text.pollinations.ai/', {
                jsonMode: true,
                messages: [
                    { role: 'system', content: 'You are an algorithmic forecaster. Output strict JSON only without any markdown formatting.' },
                    { role: 'user', content: prompt }
                ]
            });
            response = pxResponse.data;
        }

        try {
            const jsonStr = String(response).replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (parseErr) {
            console.error('Failed to parse AI forecast JSON:', response);
            return { has_prediction: false, confidence_level: 0 };
        }
    } catch (error) {
        console.error('Forecast Service Error:', error.message);
        return { has_prediction: false, confidence_level: 0 };
    }
};

module.exports = { generateEventExplanation, generateComprehensiveExplanation, isSignificantChange, generatePredictiveForecast };
