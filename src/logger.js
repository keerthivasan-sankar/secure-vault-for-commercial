#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const LOG_DIR = path.join(__dirname, '..', 'logs');
const LOG_PATH = path.join(LOG_DIR, 'activity.log');

function log(action, details = {}) {
    try {
        fs.mkdirSync(LOG_DIR, { recursive: true });
        const entry = {
            time: new Date().toISOString(),
            action,
            ...details
        };
        fs.appendFileSync(LOG_PATH, JSON.stringify(entry) + '\n');
    } catch (e) {}
}

module.exports = { log };
