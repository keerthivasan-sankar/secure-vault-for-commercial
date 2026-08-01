#!/usr/bin/env node
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const os = require('os');

const SETTINGS_PATH = path.join(__dirname, '..', 'config', 'settings.json');

function loadSettings() {
    try {
        if (fs.existsSync(SETTINGS_PATH)) {
            return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
        }
    } catch (e) {}
    return { email: { enabled: false, to: '', from: '', password: '' } };
}

function saveSettings(settings) {
    fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true });
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

async function sendAlert(action, details = {}) {
    const settings = loadSettings();
    if (!settings.email.enabled) {
        console.log('?? Email alerts disabled');
        return;
    }

    try {
        // Updated transporter with correct Gmail settings
        const transporter = nodemailer.createTransport({
            host: 'smtp.gmail.com',
            port: 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: settings.email.from,
                pass: settings.email.password
            },
            tls: {
                rejectUnauthorized: false // Fix for certificate issue
            }
        });

        const message = `
?? SECURE VAULT ALERT

Action: ${action}
File: ${details.file || 'N/A'}
Location: ${details.location || 'N/A'}
User: ${os.userInfo().username}
Computer: ${os.hostname()}
Time: ${new Date().toLocaleString()}
`;

        const info = await transporter.sendMail({
            from: `"Secure Vault" <${settings.email.from}>`,
            to: settings.email.to,
            subject: `?? Secure Vault: ${action}`,
            text: message
        });

        console.log('?? Alert email sent!');
    } catch (e) {
        console.log('?? Email failed:', e.message);
        console.log('?? Check your app password and internet connection');
    }
}

// CLI configuration
if (require.main === module) {
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const ask = (q) => new Promise(resolve => rl.question(q, resolve));

    (async () => {
        console.log('\n?? Email Alert Configuration');
        console.log('========================================');
        console.log('For Gmail, use App Password:');
        console.log('https://myaccount.google.com/apppasswords\n');

        const settings = loadSettings();
        const enable = await ask('Enable email alerts? (y/n): ');
        settings.email.enabled = enable.toLowerCase() === 'y';

        if (settings.email.enabled) {
            settings.email.from = await ask('Your Gmail address: ');
            settings.email.password = await ask('Gmail App Password: ');
            settings.email.to = await ask('Alert recipient email: ');
        }

        saveSettings(settings);
        console.log('\n? Email settings saved!');
        console.log('?? Config saved to:', SETTINGS_PATH);
        rl.close();
    })();
}

module.exports = { sendAlert, loadSettings, saveSettings };
