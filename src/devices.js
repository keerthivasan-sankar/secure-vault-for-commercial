#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const REGISTRY_PATH = path.join(__dirname, '..', 'config', 'registered-devices.json');

if (!fs.existsSync(REGISTRY_PATH)) {
    console.log('No registered devices');
    process.exit(0);
}

const registry = JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8'));
if (registry.devices.length === 0) {
    console.log('No registered devices');
} else {
    console.log('Registered devices:');
    for (const d of registry.devices) {
        console.log(`  ${d.drive}  [${d.kind}]  registered: ${d.registeredAt || 'unknown'}`);
    }
}
