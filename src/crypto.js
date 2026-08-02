#!/usr/bin/env node
const crypto = require('crypto');

const SCRYPT_N = 2 ** 15;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LEN = 32;
const SALT_LEN = 16;
const IV_LEN = 12;
const TAG_LEN = 16;
const MAGIC = Buffer.from('SVLT');
const VERSION = 2;
const KEY_KIND = { MASTER: 0, DEVICE: 1 };

// Best-effort zeroing of key material once it's no longer needed.
// NOTE: this reduces the window a key sits in memory, but it is not an
// absolute guarantee - Node.js/V8 may have made internal copies (e.g. during
// GC, or if the buffer's memory was paged to disk by the OS) that this
// cannot reach. Treat this as defense-in-depth, not a hard guarantee.
function wipe(buf) {
    if (Buffer.isBuffer(buf)) {
        buf.fill(0);
    }
}

function deriveKey(secret, salt) {
    return crypto.scryptSync(secret, salt, KEY_LEN, {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: 256 * 1024 * 1024
    });
}

function encryptBuffer(plaintext, secret, keyKind = KEY_KIND.MASTER) {
    const salt = crypto.randomBytes(SALT_LEN);
    const iv = crypto.randomBytes(IV_LEN);
    const key = deriveKey(secret, salt);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const authTag = cipher.getAuthTag();
    wipe(key);

    return Buffer.concat([
        MAGIC,
        Buffer.from([VERSION, keyKind]),
        salt,
        iv,
        authTag,
        ciphertext
    ]);
}

function decryptBuffer(data, secret) {
    if (data.length < MAGIC.length + 2 + SALT_LEN + IV_LEN + TAG_LEN) {
        throw new Error('File too short');
    }
    if (!data.subarray(0, 4).equals(MAGIC)) {
        throw new Error('Not a vault file');
    }

    let offset = 4;
    const version = data[offset]; offset += 1;
    if (version !== VERSION) throw new Error('Unsupported vault version');
    const keyKind = data[offset]; offset += 1;

    const salt = data.subarray(offset, offset + SALT_LEN); offset += SALT_LEN;
    const iv = data.subarray(offset, offset + IV_LEN); offset += IV_LEN;
    const authTag = data.subarray(offset, offset + TAG_LEN); offset += TAG_LEN;
    const ciphertext = data.subarray(offset);

    const key = deriveKey(secret, salt);
    let plaintext;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } finally {
        wipe(key);
    }
    return { plaintext, keyKind };
}

function peekKeyKind(data) {
    if (data.length < 6 || !data.subarray(0, 4).equals(MAGIC)) {
        throw new Error('Not a vault file');
    }
    return data[5];
}

// ============================================
// PER-FILE KEY ENCRYPTION
// ============================================
function encryptWithPerFileKey(plaintext, masterKey) {
    // 1. Generate file-specific key
    const fileKey = crypto.randomBytes(32);

    // 2. Encrypt file key with master key
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const derivedKey = deriveKey(masterKey, salt);
    const cipher = crypto.createCipheriv('aes-256-gcm', derivedKey, iv);
    const encryptedKey = Buffer.concat([cipher.update(fileKey), cipher.final()]);
    const authTag = cipher.getAuthTag();
    wipe(derivedKey);

    // 3. Encrypt file with file key
    const fileIv = crypto.randomBytes(12);
    const fileCipher = crypto.createCipheriv('aes-256-gcm', fileKey, fileIv);
    const ciphertext = Buffer.concat([fileCipher.update(plaintext), fileCipher.final()]);
    const fileAuthTag = fileCipher.getAuthTag();
    wipe(fileKey);

    // 4. Combine: SALT(16) + IV(12) + TAG(16) + ENC_KEY(32) + FILE_IV(12) + FILE_TAG(16) + CIPHERTEXT
    return Buffer.concat([
        salt, iv, authTag, encryptedKey,
        fileIv, fileAuthTag, ciphertext
    ]);
}

function decryptWithPerFileKey(data, masterKey) {
    let offset = 0;

    const salt = data.subarray(offset, offset + 16); offset += 16;
    const iv = data.subarray(offset, offset + 12); offset += 12;
    const authTag = data.subarray(offset, offset + 16); offset += 16;
    const encryptedKey = data.subarray(offset, offset + 32); offset += 32;

    const derivedKey = deriveKey(masterKey, salt);
    let fileKey;
    try {
        const decipher = crypto.createDecipheriv('aes-256-gcm', derivedKey, iv);
        decipher.setAuthTag(authTag);
        fileKey = Buffer.concat([decipher.update(encryptedKey), decipher.final()]);
    } finally {
        wipe(derivedKey);
    }

    const fileIv = data.subarray(offset, offset + 12); offset += 12;
    const fileAuthTag = data.subarray(offset, offset + 16); offset += 16;
    const ciphertext = data.subarray(offset);

    try {
        const fileDecipher = crypto.createDecipheriv('aes-256-gcm', fileKey, fileIv);
        fileDecipher.setAuthTag(fileAuthTag);
        return Buffer.concat([fileDecipher.update(ciphertext), fileDecipher.final()]);
    } finally {
        wipe(fileKey);
    }
}

module.exports = {
    encryptBuffer,
    decryptBuffer,
    peekKeyKind,
    KEY_KIND,
    encryptWithPerFileKey,
    decryptWithPerFileKey,
    deriveKey,
    wipe
};
