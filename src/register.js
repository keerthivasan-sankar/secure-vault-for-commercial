#!/usr/bin/env node
const fs = require('fs');
const { registerMaster, registerDevice } = require('./auth');

const args = process.argv.slice(2);
const kind = args[0];
const drive = args[1];

if (!kind || !drive || !['master', 'device'].includes(kind)) {
    console.error('Usage:');
    console.error('  node register.js master D:\\    (register master USB)');
    console.error('  node register.js device F:\\    (register per-device USB)');
    process.exit(1);
}

// Normalize and validate the drive letter. Accepts e, E, E:, E:\, e:\ etc.
// Rejects anything that isn't a single drive letter, so a typo (like just
// "e" with no colon) can never be silently written as a relative folder
// instead of the actual drive root.
const driveMatch = drive.trim().match(/^([a-zA-Z]):?\\?$/);
if (!driveMatch) {
    console.error(`Invalid drive: "${drive}"`);
    console.error('Enter just the drive letter, e.g. E:  or  E:\\');
    process.exit(1);
}
const normalizedDrive = driveMatch[1].toUpperCase() + ':\\';

if (!fs.existsSync(normalizedDrive)) {
    console.error(`Drive ${normalizedDrive} was not found. Is the USB drive plugged in?`);
    process.exit(1);
}

if (kind === 'master') registerMaster(normalizedDrive);
else registerDevice(normalizedDrive);
