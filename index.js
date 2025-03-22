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
const OpenAI = require('openai');
const fileUpload = require('express-fileupload');

var app = Express();
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(bodyParser.json());

// Serve static files from the public directory
app.use('/static', Express.static(path.join(__dirname, 'public')));

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max file size
  abortOnLimit: true,
  createParentPath: true,
  useTempFiles: false
}));

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Initialize OpenAI
const openai = new OpenAI(process.env.OPENAI_API_KEY);

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
    try {
        const userInfo = await conn.login(salesforceUsername, salesforcePassword);
        const result = await conn.query(QUERIES.GET_JOB);
        console.log('GET_JOB Query:', QUERIES.GET_JOB);
        console.log('Job data retrieved:', result.records.length > 0 ? {
            Id: result.records[0].Id,
            Job_Public_Name__c: result.records[0].Job_Public_Name__c
        } : 'No job found');
        return response.send(result);
    } catch (error) {
        console.error('Error retrieving jobs:', error);
        return response.status(500).send({ error: 'Failed to retrieve job data' });
    }
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

app.post('/processInternalAnswerGemini', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { answer, question, field, jobData } = req.body;

        if (!jobData) {
            console.error('Missing required data:', { jobData });
            return res.status(400).json({ error: 'Missing required job or opportunity data' });
        }            

       
        const context = `A candidate applying for a job position with job description "${jobData[JOB_FIELDS.STANDARDIZED_JOB_DESCRIPTION]}" provided answer "${answer}" for the question "${question}.
                         Can you detemine whether the candidate is a good fit for the position. Be concise and precise. Give me only one bullet point`;

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


app.post('/generateFifthQuestion', async (req, res) => {
    try {
        const { jobData,question,answer, analysis1, analysis2, analysis3,question1,question2,question3 } = req.body;
        if (!jobData) {
            console.error('Missing required data:', { jobData });
            return res.status(400).json({ error: 'Missing required job or opportunity data' });
        }

        const context1 = `A candidate applying for a job position with job description "${jobData[JOB_FIELDS.STANDARDIZED_JOB_DESCRIPTION]}" provided answer "${answer}" for the question "${question}.
                         Can you detemine whether the candidate is a good fit for the position. Be concise and precise. Give me only one bullet point`;

        const context = `A candidate applying for a job position with job description "${jobData[JOB_FIELDS.STANDARDIZED_JOB_DESCRIPTION]}"
            provided answer "${answer}" for the question "${question},
            answer "${question1}" for the question "${analysis1},
            answer "${question2}" for the question "${analysis2} and
            answer "${question3}" for the question "${analysis3}.
            Can you generate another interview question based on the provided information above.`;

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
// Updated Gemini endpoint
app.post('/processWithGemini', async (req, res) => {
    try {
        console.log('Received request body:', req.body);
        const { jobData, opportunityData, promptId, analysis1, analysis2, analysis3 } = req.body;

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
        
        // Create a copy of the prompt template for modification
        let promptTemplate = prompt.template;
        
        // Replace all placeholders with their values
        promptTemplate = promptTemplate.replace(/\{\{answer\}\}/g, answer);
        
        // Handle the new placeholders for generate_next_question prompt
        if (promptId === 'generate_next_question') {
            const jobDescription = jobData[JOB_FIELDS.STANDARDIZED_JOB_DESCRIPTION] || 'Not provided';
            promptTemplate = promptTemplate
                .replace(/\{\{analysis1\}\}/g, analysis1 || 'Not provided')
                .replace(/\{\{analysis2\}\}/g, analysis2 || 'Not provided')
                .replace(/\{\{analysis3\}\}/g, analysis3 || 'Not provided')
                .replace(/\{\{jobDescription\}\}/g, jobDescription);
        }

        // Create the context string
        const context = `
Job Information:
- Title: ${jobData[JOB_FIELDS.JOB_PUBLIC_NAME] || 'N/A'}
- Question: ${jobData[JOB_FIELDS.OPPORTUNITY_DISCUSSED_Q1] || 'N/A'}

Opportunity Information:
- First Question: ${opportunityData[OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_Q1] || 'N/A'}
- Second Question: ${opportunityData[OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_Q2] || 'N/A'}
- Third Question: ${opportunityData[OPPORTUNITY_DISCUSSED_FIELDS.INTERNAL_Q3] || 'N/A'}
- Current Answer: ${answer}

${promptTemplate}`;

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

// Text-to-speech endpoint
app.post('/text-to-speech', async (req, res) => {
    try {
        const { text, voice = 'coral', instructions = 'Speak in a professional tone.' } = req.body;
        
        if (!text) {
            return res.status(400).json({ error: 'Text is required' });
        }
        
        // Generate a unique filename
        const filename = `speech_${Date.now()}.mp3`;
        const speechFile = path.join(__dirname, 'public', 'speech', filename);
        
        // Generate speech using OpenAI
        const mp3 = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: voice,
            input: text,
            instructions: instructions,
        });
        
        // Save the file
        const buffer = Buffer.from(await mp3.arrayBuffer());
        await fs.promises.writeFile(speechFile, buffer);
        
        // Return the URL to the audio file
        res.json({ 
            success: true, 
            audioUrl: `/static/speech/${filename}` 
        });
    } catch (error) {
        console.error('Error generating speech:', error);
        res.status(500).json({ 
            error: 'Error generating speech', 
            details: error.message 
        });
    }
});

// Speech-to-text endpoint
app.post('/speech-to-text', async (req, res) => {
    try {
        // Check if a file was uploaded
        if (!req.files || !req.files.audio) {
            console.error('No audio file uploaded');
            return res.status(400).json({ error: 'No audio file uploaded' });
        }

        const audioFile = req.files.audio;
        console.log('Received audio file:', {
            name: audioFile.name,
            size: audioFile.size,
            mimetype: audioFile.mimetype
        });
        
        if (audioFile.size < 100) {
            console.error('Audio file too small');
            return res.status(400).json({ error: 'Audio file too small or empty' });
        }

        // Create a unique filename with timestamp
        const timestamp = Date.now();
        
        // Handle different formats from different browsers
        let extension = 'webm';
        if (audioFile.name && audioFile.name.includes('.')) {
            extension = audioFile.name.split('.').pop();
        } else if (audioFile.mimetype) {
            // Handle some common MIME types
            if (audioFile.mimetype.includes('wav')) extension = 'wav';
            if (audioFile.mimetype.includes('mp4')) extension = 'mp4';
            if (audioFile.mimetype.includes('mp3')) extension = 'mp3';
            if (audioFile.mimetype.includes('ogg')) extension = 'ogg';
        }
        
        const tempFilePath = path.join(__dirname, 'temp', `recording_${timestamp}.${extension}`);
        
        // Ensure the temp directory exists
        const tempDir = path.join(__dirname, 'temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }
        
        // Save the uploaded file
        await fs.promises.writeFile(tempFilePath, audioFile.data);
        console.log(`Saved audio file to ${tempFilePath} (${extension} format)`);
        
        // Transcribe the audio using OpenAI's Whisper model
        console.log('Sending to OpenAI Whisper for transcription...');
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tempFilePath),
            model: "whisper-1",
            language: "en",
            response_format: "json"
        });
        
        console.log('Received transcription:', transcription.text);
        
        // Clean up the temporary file
        fs.unlink(tempFilePath, (err) => {
            if (err) console.error('Error deleting temporary file:', err);
        });
        
        // Return the transcription
        res.json({
            success: true,
            text: transcription.text
        });
    } catch (error) {
        console.error('Error transcribing speech:', error);
        res.status(500).json({
            error: 'Error transcribing speech',
            details: error.message
        });
    }
});

app.listen(5038, ()=>{
    console.log(`server is running at 5038`)
});





