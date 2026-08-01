const crypto = require('crypto');
const fs = require('fs');

function generateChecksum(filePath) {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash('sha256');
        const stream = fs.createReadStream(filePath);
        stream.on('data', data => hash.update(data));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', reject);
    });
}

function generateChecksumSync(filePath) {
    const hash = crypto.createHash('sha256');
    const data = fs.readFileSync(filePath);
    hash.update(data);
    return hash.digest('hex');
}

function saveChecksum(filePath, checksum) {
    const checksumPath = filePath + '.sha256';
    fs.writeFileSync(checksumPath, checksum);
    return checksumPath;
}

function verifyChecksum(filePath, expectedChecksum) {
    const actual = generateChecksumSync(filePath);
    return actual === expectedChecksum;
}

module.exports = {
    generateChecksum,
    generateChecksumSync,
    saveChecksum,
    verifyChecksum
};
