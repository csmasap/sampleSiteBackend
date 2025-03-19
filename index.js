require('dotenv').config();
var Express = require("express");
var cors = require("cors");
const multer = require("multer");
const jsforce = require('jsforce');
const bodyParser = require('body-parser');
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { OBJECT_NAMES, JOB_FIELDS, OPPORTUNITY_DISCUSSED_FIELDS, RECORD_IDS, QUERIES } = require('./salesforce-fields');

var app = Express();
app.use(cors());

app.use(bodyParser.json());

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const conn = new jsforce.Connection(
    {loginUrl : 'https://login.salesforce.com'}
);

const salesforceUsername = process.env.SALESFORCE_USERNAME;
const salesforcePassword = process.env.SALESFORCE_PASSWORD + process.env.SALESFORCE_SECURITY_TOKEN;

// Helper function to read prompts
function getPrompts() {
    try {
        const promptsPath = path.join(__dirname, 'prompts.json');
        const promptsData = fs.readFileSync(promptsPath, 'utf8');
        return JSON.parse(promptsData);
    } catch (error) {
        console.error('Error reading prompts file:', error);
        return { prompts: [] };
    }
}

// Helper function to write prompts
function savePrompts(promptsData) {
    try {
        const promptsPath = path.join(__dirname, 'prompts.json');
        fs.writeFileSync(promptsPath, JSON.stringify(promptsData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing prompts file:', error);
        return false;
    }
}

// Existing endpoints
app.get('/', async (req, res) => {
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    res.send("Welcome");
});

// Add prompts endpoints
app.get('/prompts', (req, res) => {
    const promptsData = getPrompts();
    res.json(promptsData);
});

// Add a new prompt
app.post('/prompts', (req, res) => {
    try {
        const { name, template } = req.body;
        
        if (!name || !template) {
            return res.status(400).json({ error: 'Name and template are required' });
        }
        
        const promptsData = getPrompts();
        const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now();
        
        promptsData.prompts.push({
            id,
            name,
            template
        });
        
        savePrompts(promptsData);
        res.json({ success: true, prompt: { id, name, template } });
    } catch (error) {
        console.error('Error adding prompt:', error);
        res.status(500).json({ error: 'Failed to add prompt' });
    }
});

// Update a prompt
app.put('/prompts/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, template } = req.body;
        
        if (!name || !template) {
            return res.status(400).json({ error: 'Name and template are required' });
        }
        
        const promptsData = getPrompts();
        const promptIndex = promptsData.prompts.findIndex(p => p.id === id);
        
        if (promptIndex === -1) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        promptsData.prompts[promptIndex] = {
            ...promptsData.prompts[promptIndex],
            name,
            template
        };
        
        savePrompts(promptsData);
        res.json({ success: true, prompt: promptsData.prompts[promptIndex] });
    } catch (error) {
        console.error('Error updating prompt:', error);
        res.status(500).json({ error: 'Failed to update prompt' });
    }
});

// Delete a prompt
app.delete('/prompts/:id', (req, res) => {
    try {
        const { id } = req.params;
        
        const promptsData = getPrompts();
        const initialLength = promptsData.prompts.length;
        
        // Don't allow deleting the custom prompt
        if (id === 'custom') {
            return res.status(400).json({ error: 'Cannot delete the custom prompt' });
        }
        
        promptsData.prompts = promptsData.prompts.filter(p => p.id !== id);
        
        if (promptsData.prompts.length === initialLength) {
            return res.status(404).json({ error: 'Prompt not found' });
        }
        
        savePrompts(promptsData);
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting prompt:', error);
        res.status(500).json({ error: 'Failed to delete prompt' });
    }
});

app.get('/getJobs', async (request, response) => {
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    const result = await conn.query(QUERIES.GET_JOB);
    return response.send(result);    
});

app.get('/getOpportunityDiscussed', async (request, response) => {
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    const result = await conn.query(QUERIES.GET_OPPORTUNITY_DISCUSSED);
    return response.send(result);    
});

app.post('/updateOpportunityDiscussed', async (request, response) => {
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    const { answer } = request.body;
    
    const updateObject = {
        [OPPORTUNITY_DISCUSSED_FIELDS.ID]: RECORD_IDS.OPPORTUNITY_DISCUSSED_ID,
        [OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_ANSWER1]: answer     
    };
    
    const ret = await conn.sobject(OBJECT_NAMES.OPPORTUNITY_DISCUSSED).update(updateObject);
    return response.send(ret);    
});

app.post('/updateJob', async (request, response) => {
    const userInfo = await conn.login(salesforceUsername, salesforcePassword);
    console.log(request.body);
    const { Id, answer } = request.body;
    
    const updateObject = {
        [JOB_FIELDS.ID]: Id,
        [JOB_FIELDS.VMS_LAST_PAYLOAD]: answer     
    };
    
    const ret = await conn.sobject(OBJECT_NAMES.JOB).update(updateObject);
    console.log(ret);
    return response.send(ret);    
});

// Updated Gemini endpoint
app.post('/processWithGemini', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { jobData, opportunityData, promptId } = req.body;

        if (!jobData || !opportunityData) {
            console.error('Missing required data:', { jobData, opportunityData });
            return res.status(400).json({ error: 'Missing required job or opportunity data' });
        }

        if (!promptId) {
            return res.status(400).json({ error: 'Prompt ID is required' });
        }

        // Get the answer from the opportunity data
        const answer = opportunityData[OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_ANSWER1] || 'Not provided';

        // Get the prompt template from promptId
        const promptsData = getPrompts();
        const prompt = promptsData.prompts.find(p => p.id === promptId);
        
        if (!prompt) {
            return res.status(404).json({ error: 'Prompt not found with the provided ID' });
        }
        
        // Replace the {{answer}} placeholder with the actual answer
        const promptTemplate = prompt.template.replace(/\{\{answer\}\}/g, answer);

        // Create the context string
        const context = `
Job Information:
- Title: ${jobData[JOB_FIELDS.JOB_PUBLIC_NAME] || 'N/A'}
- Question: ${jobData[JOB_FIELDS.OPPORTUNITY_DISCUSSED_Q1] || 'N/A'}

Opportunity Information:
- Internal Question: ${opportunityData[OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_Q1] || 'N/A'}
- Current Answer: ${answer}

Based on this information, ${promptTemplate}`;

        // Make the API request
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: context
                    }]
                }]
            })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(`Gemini API error: ${JSON.stringify(errorData)}`);
        }

        const data = await response.json();
        console.log('Gemini API Response:', data);

        // Extract the generated text from the response
        const generatedText = data.candidates[0].content.parts[0].text;
        
        res.json({ analysis: generatedText });
    } catch (error) {
        console.error('Error in Gemini processing:', error);
        res.status(500).json({ 
            error: 'Error processing with Gemini API', 
            details: error.message 
        });
    }
});

app.listen(5038, ()=>{
    console.log(`server is running at 5038`)
});





