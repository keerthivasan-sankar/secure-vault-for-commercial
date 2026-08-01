#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const MASTER_KEY_FILENAME = '.vault_master.key';
const DEVICE_KEY_FILENAME = '.vault_device.key';
const REGISTRY_PATH = path.join(__dirname, '..', 'config', 'registered-devices.json');

function loadRegistry() {
    if (!fs.existsSync(REGISTRY_PATH)) return { devices: [] };
    try { return JSON.parse(fs.readFileSync(REGISTRY_PATH, 'utf8')); }
    catch (e) { return { devices: [] }; }
}

function saveRegistry(registry) {
    fs.mkdirSync(path.dirname(REGISTRY_PATH), { recursive: true });
    fs.writeFileSync(REGISTRY_PATH, JSON.stringify(registry, null, 2));
}

function recordDevice(drive, kind) {
    const registry = loadRegistry();
    const existing = registry.devices.find(d => d.drive === drive && d.kind === kind);
    if (existing) {
        existing.lastSeen = new Date().toISOString();
    } else {
        registry.devices.push({
            drive,
            kind,
            registeredAt: new Date().toISOString(),
            lastSeen: new Date().toISOString()
        });
    }
    saveRegistry(registry);
}

function findMasterKeyFile() {
    for (let i = 67; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':' + path.sep;
        if (!fs.existsSync(drive)) continue;
        const candidate = path.join(drive, MASTER_KEY_FILENAME);
        if (fs.existsSync(candidate)) return candidate;
    }
    return null;
}

function loadMasterKey() {
    const keyPath = findMasterKeyFile();
    if (!keyPath) {
        throw new Error('Master USB key not found. Insert your registered master USB drive.');
    }
    const key = fs.readFileSync(keyPath);
    if (key.length !== 32) throw new Error('Master key file is corrupted.');
    return key;
}

function registerMaster(drive) {
    const d = drive.endsWith(path.sep) ? drive : drive + path.sep;
    const keyPath = path.join(d, MASTER_KEY_FILENAME);
    if (fs.existsSync(keyPath)) {
        console.log(`? Master key already exists on ${drive}`);
        recordDevice(d, 'master');
        return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    recordDevice(d, 'master');
    console.log(`? Master key registered on ${drive}`);
    console.log(`?? Key file: ${keyPath}`);
    console.log('\n??  BACKUP THIS FILE:');
    console.log(`   Copy ${MASTER_KEY_FILENAME} to a safe location OFF this PC`);
    console.log('   Losing this key means losing access to encrypted files!\n');
    return key;
}

function loadDeviceKey(driveLetter) {
    const drive = driveLetter.endsWith(path.sep) ? driveLetter : driveLetter + path.sep;
    const keyPath = path.join(drive, DEVICE_KEY_FILENAME);
    if (!fs.existsSync(keyPath)) {
        throw new Error(`${driveLetter} has no device key registered.`);
    }
    const key = fs.readFileSync(keyPath);
    if (key.length !== 32) throw new Error('Device key file is corrupted.');
    return key;
}

function registerDevice(drive) {
    const d = drive.endsWith(path.sep) ? drive : drive + path.sep;
    const keyPath = path.join(d, DEVICE_KEY_FILENAME);
    if (fs.existsSync(keyPath)) {
        console.log(`? Device key already exists on ${drive}`);
        recordDevice(d, 'device');
        return fs.readFileSync(keyPath);
    }
    const key = crypto.randomBytes(32);
    fs.writeFileSync(keyPath, key);
    recordDevice(d, 'device');
    console.log(`? Device key registered on ${drive}`);
    console.log(`?? Key file: ${keyPath}`);
    console.log('\n??  This key is BOUND TO THIS DRIVE:');
    console.log(`   ${drive} is now required to decrypt files from this drive`);
    console.log('   Do NOT delete this key file unless you want to lose access!\n');
    return key;
}

module.exports = {
    loadMasterKey,
    registerMaster,
    loadDeviceKey,
    registerDevice
};
