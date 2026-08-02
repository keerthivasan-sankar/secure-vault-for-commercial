#!/usr/bin/env node
const fs = require('fs');
const { registerMaster, registerDevice } = require('./auth');
const { askSecret } = require('./password-input');
const { wipe } = require('./crypto');

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

async function main() {
    // Password is always prompted interactively here, never taken as a
    // command-line argument - CLI args can end up in shell history and are
    // visible to other processes on the system while this one is running.
    console.log('\nA password is required to protect this key.');
    console.log('IMPORTANT: There is no password recovery. If you forget this');
    console.log('password, files encrypted with this key are permanently');
    console.log('unrecoverable - even with this exact USB drive in hand.');
    console.log('Choose a password you will remember or store safely (e.g. in a');
    console.log('password manager), and enter it here (8+ chars):');
    const passwordBuf = await askSecret('');
    if (!passwordBuf || passwordBuf.length < 8) {
        wipe(passwordBuf);
        console.error('Password must be at least 8 characters');
        process.exit(1);
    }

    console.log('Confirm password:');
    const confirmBuf = await askSecret('');
    const crypto = require('crypto');
    const matches = passwordBuf.length === confirmBuf.length &&
        crypto.timingSafeEqual(passwordBuf, confirmBuf);
    wipe(confirmBuf);
    if (!matches) {
        wipe(passwordBuf);
        console.error('Passwords do not match');
        process.exit(1);
    }

    try {
        const rawKey = kind === 'master'
            ? registerMaster(normalizedDrive, passwordBuf)
            : registerDevice(normalizedDrive, passwordBuf);
        wipe(rawKey);
    } catch (e) {
        console.error(e.message);
        process.exit(1);
    } finally {
        wipe(passwordBuf);
    }
}

main().catch((e) => {
    console.error(e.message);
    process.exit(1);
});
