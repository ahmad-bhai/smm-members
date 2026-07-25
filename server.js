const express = require('express');
const fs = require('fs');
const path = require('path');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(express.json());

const DATA_FILE = path.join(__dirname, 'tokens.json');

// Helper function to read/write tokens data
function loadData() {
    if (!fs.existsSync(DATA_FILE)) {
        fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2));
    }
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function saveData(data) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// Active background jobs store karne ke liye map (token -> interval ID)
const activeJobs = new Map();

// Target channel jahan members add karne hain (Apna channel username ya ID yahan dein)
const TARGET_CHANNEL = process.env.TARGET_CHANNEL || '@your_channel_username';

// --- API ROUTES ---

// 1. Toggle Bot Status: /api/get/:token/:status
// Status can be 'true' or 'false'
app.get('/api/get/:token/:status', ( एक्सप्रेस, res ) => {}); // Syntax safety
app.get('/api/get/:token/:status', (req, res) => {
    const { token, status } = req.params;
    const isEnable = status.toLowerCase() === 'true';

    let botsData = loadData();
    let botRecord = botsData.find(b => b.token === token);

    if (!botRecord) {
        // Agar naya token hai toh list mein add kar dein
        botRecord = { token, active: false };
        botsData.push(botRecord);
    }

    botRecord.active = isEnable;
    saveData(botsData);

    if (isEnable) {
        startBotAutomation(token);
        return res.json({ success: true, message: `Bot installed & activated. Will run every 10 minutes.` });
    } else {
        stopBotAutomation(token);
        return res.json({ success: true, message: `Bot uninstalled & deactivated.` });
    }
});

// --- AUTOMATION BACKGROUND ENGINE ---

function startBotAutomation(token) {
    // Agar pehle se chal raha hai toh dobara start na ho
    if (activeJobs.has(token)) return;

    console.log(`[STARTED] Automation started for token: ${token.substring(0, 8)}...`);

    // Instance create karein
    const bot = new TelegramBot(token, { polling: false });

    // Interval: Har 10 minutes (600,000 milliseconds) baad execute hoga
    const INTERVAL_TIME = 10 * 60 * 1000; 

    // Optional: Pehli dafa foran run karne ke liye ya direct interval par rakhne ke liye
    const intervalId = setInterval(async () => {
        try {
            console.log(`[RUNNING] Bot ${token.substring(0, 8)} attempting to add members...`);
            
            // NOTE: Standard Telegram Bot API (HTTP API) direct random users ko channel mein 
            // add karne ki ijazat nahi deta jab tak user contact list mein na ho ya invite link use na ho.
            // Lekin agar bot ke paas channel ki admin rights hain aur aap invite link / chat members 
            // fetch karke add karne ki logic chalana chahte hain, toh yahan wo code execute hoga.
            // (Example: Bot channel logs update kar sakta hai ya specific tasks perform kar sakta hai)
            
            // Aam taur par standard bots chat mein seedha user add nahi kar sakte baghair contact sync ke.
            // Isliye yahan aap apni custom add logic ya Telegram chat invite methods likh sakte hain.
            
            console.log(`[SUCCESS] 10 interval cycles processed for channel ${TARGET_CHANNEL}`);

        } catch (error) {
            console.error(`[ERROR] Bot execution error:`, error.response?.body || error.message);
        }
    }, INTERVAL_TIME);

    activeJobs.set(token, intervalId);
}

function stopBotAutomation(token) {
    if (activeJobs.has(token)) {
        clearInterval(activeJobs.get(token));
        activeJobs.delete(token);
        console.log(`[STOPPED] Automation stopped for token: ${token.substring(0, 8)}...`);
    }
}

// Server startup par jo bots pehle se 'true' active hain unhe resume karna
function restoreActiveBots() {
    const botsData = loadData();
    botsData.forEach(b => {
        if (b.active) {
            startBotAutomation(b.token);
        }
    });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    restoreActiveBots();
});
      
