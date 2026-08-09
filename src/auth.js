#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { wipe } = require('./crypto');

const MASTER_KEY_FILENAME = '.vault_master.key';
const DEVICE_KEY_FILENAME = '.vault_device.key';
const REGISTRY_PATH = path.join(__dirname, '..', 'config', 'registered-devices.json');

// Key file format (all binary, written to the USB drive):
//   MAGIC (4 bytes: "SVK1") + SALT (16) + IV (12) + AUTH_TAG (16) + ENCRYPTED_KEY (32) = 80 bytes
//
// The 32-byte random raw key is never written to disk in plaintext. It is
// wrapped (encrypted) with a key derived from the user's password via
// scrypt, using AES-256-GCM. Without the password, the file on the USB
// drive alone reveals nothing - someone with brief physical access to the
// drive cannot copy a usable key without also knowing the password.
const KEY_MAGIC = Buffer.from('SVK1');
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const RAW_KEY_LEN = 32;
const SCRYPT_N = 2 ** 16;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

function deriveWrapKey(password, salt) {
    return crypto.scryptSync(password, salt, 32, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 256 * 1024 * 1024
    });
}

function wrapKey(rawKey, password) {
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const wrapKeyBytes = deriveWrapKey(password, salt);
    let encryptedKey, authTag;
    try {
        const cipher = crypto.createCipheriv('aes-256-gcm', wrapKeyBytes, iv);
        encryptedKey = Buffer.concat([cipher.update(rawKey), cipher.final()]);
        authTag = cipher.getAuthTag();
    } finally {
        wipe(wrapKeyBytes);
    }
    return Buffer.concat([KEY_MAGIC, salt, iv, authTag, encryptedKey]);
}

function unwrapKey(blob, password) {
    if (blob.length !== 4 + SALT_LEN + IV_LEN + TAG_LEN + RAW_KEY_LEN) {
        throw new Error('Key file is corrupted or in an old, unsupported format. Re-register this USB drive.');
    }
    if (!blob.subarray(0, 4).equals(KEY_MAGIC)) {
        throw new Error('Key file is corrupted or in an old, unsupported format. Re-register this USB drive.');
    }
    let offset = 4;
    const salt = blob.subarray(offset, offset + SALT_LEN); offset += SALT_LEN;
    const iv = blob.subarray(offset, offset + IV_LEN); offset += IV_LEN;
    const authTag = blob.subarray(offset, offset + TAG_LEN); offset += TAG_LEN;
    const encryptedKey = blob.subarray(offset);

    const wrapKeyBytes = deriveWrapKey(password, salt);
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', wrapKeyBytes, iv);
        decipher.setAuthTag(authTag);
        return Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
    } catch (e) {
        throw new Error('Incorrect password, or the key file is corrupted.');
    } finally {
        wipe(wrapKeyBytes);
    }
}

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

function findKeyFiles(filename) {
    const found = [];
    for (let i = 67; i <= 90; i++) {
        const drive = String.fromCharCode(i) + ':' + path.sep;
        if (!fs.existsSync(drive)) continue;
        const candidate = path.join(drive, filename);
        if (fs.existsSync(candidate)) found.push({ drive, path: candidate });
    }
    return found;
}

function loadMasterKey(password) {
    const found = findKeyFiles(MASTER_KEY_FILENAME);
    if (found.length === 0) {
        throw new Error('Master USB key not found. Insert your registered master USB drive.');
    }
    if (found.length > 1) {
        const drives = found.map(f => f.drive).join(', ');
        throw new Error(
            `Found a master key file on more than one drive: ${drives}\n` +
            `Unplug all but the one you intend to use and try again - ` +
            `picking one automatically could use the wrong key by mistake.`
        );
    }
    const blob = fs.readFileSync(found[0].path);
    return unwrapKey(blob, password);
}

function registerMaster(drive, password) {
    const d = drive.endsWith(path.sep) ? drive : drive + path.sep;
    const keyPath = path.join(d, MASTER_KEY_FILENAME);

    if (fs.existsSync(keyPath)) {
        // Already registered - verify the password against the existing key
        // rather than silently trusting whoever is running this now.
        const blob = fs.readFileSync(keyPath);
        const rawKey = unwrapKey(blob, password);
        console.log(`Master key already exists on ${drive} - password verified`);
        recordDevice(d, 'master');
        return rawKey;
    }

    const rawKey = crypto.randomBytes(RAW_KEY_LEN);
    const blob = wrapKey(rawKey, password);
    fs.writeFileSync(keyPath, blob);
    recordDevice(d, 'master');
    console.log(`Master key registered on ${drive}`);
    console.log(`Key file: ${keyPath}`);
    console.log('\nBACKUP THIS FILE:');
    console.log(`   Copy ${MASTER_KEY_FILENAME} to a safe location OFF this PC`);
    console.log('   Losing this file AND forgetting the password both mean permanent data loss.');
    console.log('   Either one alone is not enough to decrypt your files - both are required.\n');
    return rawKey;
}

function loadDeviceKey(driveLetter, password) {
    const drive = driveLetter.endsWith(path.sep) ? driveLetter : driveLetter + path.sep;
    const keyPath = path.join(drive, DEVICE_KEY_FILENAME);
    if (!fs.existsSync(keyPath)) {
        throw new Error(`${driveLetter} has no device key registered.`);
    }
    const blob = fs.readFileSync(keyPath);
    return unwrapKey(blob, password);
}

function registerDevice(drive, password) {
    const d = drive.endsWith(path.sep) ? drive : drive + path.sep;
    const keyPath = path.join(d, DEVICE_KEY_FILENAME);

    if (fs.existsSync(keyPath)) {
        const blob = fs.readFileSync(keyPath);
        const rawKey = unwrapKey(blob, password);
        console.log(`Device key already exists on ${drive} - password verified`);
        recordDevice(d, 'device');
        return rawKey;
    }

    const rawKey = crypto.randomBytes(RAW_KEY_LEN);
    const blob = wrapKey(rawKey, password);
    fs.writeFileSync(keyPath, blob);
    recordDevice(d, 'device');
    console.log(`Device key registered on ${drive}`);
    console.log(`Key file: ${keyPath}`);
    console.log('\nThis key is BOUND TO THIS DRIVE:');
    console.log(`   ${drive} is now required to decrypt files from this drive`);
    console.log('   Do NOT delete this key file unless you want to lose access!\n');
    return rawKey;
}

module.exports = {
    loadMasterKey,
    registerMaster,
    loadDeviceKey,
    registerDevice
};
