const crypto = require('crypto');
const fs = require('fs');

// This was previously a plain, unkeyed SHA-256 hash of the encrypted file.
// That's not a real tamper check - anyone can compute a valid SHA-256 for
// any file, including a tampered one, since there's no secret involved.
// AES-GCM already authenticates the vault contents on decrypt, but this
// keyed HMAC gives a fast, explicit "has this file been altered or
// corrupted since encryption" check using the same key material, without
// needing to attempt a full decrypt first.
function generateHmac(filePath, key) {
    return new Promise((resolve, reject) => {
        const hmac = crypto.createHmac('sha256', key);
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hmac.update(data));
        stream.on('end', () => resolve(hmac.digest('hex')));
        stream.on('error', reject);
    });
}

function generateHmacSync(filePath, key) {
    const hmac = crypto.createHmac('sha256', key);
    const data = fs.readFileSync(filePath);
    hmac.update(data);
    return hmac.digest('hex');
}

function saveHmac(filePath, hmacHex) {
    const integrityPath = filePath + '.integrity';
    fs.writeFileSync(integrityPath, hmacHex);
    return integrityPath;
}

function loadHmac(filePath) {
    const integrityPath = filePath + '.integrity';
    if (!fs.existsSync(integrityPath)) return null;
    return fs.readFileSync(integrityPath, 'utf8').trim();
}

// Constant-time comparison so this check itself doesn't leak timing info.
function verifyHmac(filePath, key, expectedHex) {
    const actualHex = generateHmacSync(filePath, key);
    const actual = Buffer.from(actualHex, 'hex');
    const expected = Buffer.from(expectedHex, 'hex');
    if (actual.length !== expected.length) return false;
    return crypto.timingSafeEqual(actual, expected);
}

module.exports = {
    generateHmac,
    generateHmacSync,
    saveHmac,
    loadHmac,
    verifyHmac
};
