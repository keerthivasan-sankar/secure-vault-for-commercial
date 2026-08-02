#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { decryptBuffer, peekKeyKind, KEY_KIND, decryptWithPerFileKey, wipe } = require('./crypto');
const { loadMasterKey, loadDeviceKey } = require('./auth');
const { getDriveLetter, getSevenZipPath } = require('./platform');
const logger = require('./logger');
const { sendAlert } = require('./email-alert');
const { askSecret } = require('./password-input');
const { loadHmac, verifyHmac } = require('./checksum');

const SEVEN_ZIP = getSevenZipPath();

async function main() {
    const encFile = process.argv[2];
    const to = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : null;

    if (!encFile) {
        console.error('\nSecure Vault - Decryption');
        console.error('========================================');
        console.error('Usage: node decrypt.js <file.vault> [--to <folder>]');
        console.error('\nExamples:');
        console.error('  node decrypt.js secret.txt.vault');
        console.error('  node decrypt.js secret.txt.vault --to D:\\Restored');
        process.exit(1);
    }

    if (!fs.existsSync(encFile)) {
        console.error(`\nFile not found: ${encFile}`);
        console.error('\nSearch for .vault files:');
        console.error('   dir C:\\Users\\%USERNAME%\\Music\\*.vault');
        console.error('   dir C:\\Users\\%USERNAME%\\Desktop\\*.vault');
        console.error('   Get-ChildItem -Path C:\\Users\\%USERNAME% -Recurse -Filter "*.vault" -ErrorAction SilentlyContinue');
        process.exit(1);
    }

    console.log('\nSecure Vault - Decryption');
    console.log('========================================');
    console.log('Vault:', path.basename(encFile));

    const destDir = to ? path.resolve(to) : path.dirname(encFile);
    if (to) {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`Destination: ${destDir}`);
    }

    let rawKey = null;

    try {
        const raw = fs.readFileSync(encFile);
        const isNewFormat = raw.length > 44 && !raw.subarray(0, 4).equals(Buffer.from('SVLT'));

        const originDrive = getDriveLetter(encFile);

        // Figure out whether we need the master key or a device key by
        // checking which one is actually present/registered, same as before.
        let local = true;
        if (!isNewFormat) {
            const keyKind = peekKeyKind(raw);
            local = keyKind === KEY_KIND.MASTER;
            console.log(`Key type: ${local ? 'Master' : 'Device'}`);
        }

        let plainBuffer;

        if (isNewFormat) {
            console.log('Detected new per-file key format');

            // Try master first, fall back to device - but we need the
            // password before we can tell which one actually unlocks,
            // since the key file itself is now encrypted at rest.
            console.log('\nEnter password:');
            const passwordBuf = await askSecret('');
            if (!passwordBuf || passwordBuf.length === 0) {
                wipe(passwordBuf);
                console.error('Password required');
                process.exit(1);
            }

            try {
                try {
                    rawKey = loadMasterKey(passwordBuf);
                    console.log('Master USB key unlocked');
                } catch (e) {
                    rawKey = loadDeviceKey(originDrive, passwordBuf);
                    console.log(`Device key for ${originDrive} unlocked`);
                }
            } catch (e) {
                console.error(e.message);
                process.exit(1);
            } finally {
                wipe(passwordBuf);
            }

            const expectedMac = loadHmac(encFile);
            if (expectedMac) {
                const ok = verifyHmac(encFile, rawKey, expectedMac);
                if (!ok) {
                    console.error('Integrity check failed: this file has been modified or corrupted since it was encrypted.');
                    process.exit(1);
                }
                console.log('Integrity verified');
            } else {
                console.log('(No integrity file found - skipping tamper check)');
            }

            try {
                plainBuffer = decryptWithPerFileKey(raw, rawKey);
            } catch (e) {
                console.error('Decryption failed. Wrong password or corrupted file.');
                process.exit(1);
            }

        } else {
            console.log('Detected legacy format');

            console.log('\nEnter password:');
            const passwordBuf = await askSecret('');
            if (!passwordBuf || passwordBuf.length === 0) {
                wipe(passwordBuf);
                console.error('Password required');
                process.exit(1);
            }

            try {
                if (local) {
                    rawKey = loadMasterKey(passwordBuf);
                    console.log('Master USB key unlocked');
                } else {
                    rawKey = loadDeviceKey(originDrive, passwordBuf);
                    console.log(`Device key for ${originDrive} unlocked`);
                }
            } catch (e) {
                console.error(e.message);
                process.exit(1);
            } finally {
                wipe(passwordBuf);
            }

            try {
                const result = decryptBuffer(raw, rawKey);
                plainBuffer = result.plaintext;
            } catch (e) {
                console.error('Decryption failed. Wrong password or corrupted file.');
                process.exit(1);
            }
        }

        // Restore file/folder
        const base = path.basename(encFile, '.vault');
        const isSevenZip = plainBuffer.length > 6 &&
            plainBuffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));

        if (isSevenZip) {
            console.log('\nExtracting folder...');
            const tempArchive = path.join(destDir, base + '.tmp.7z');
            fs.writeFileSync(tempArchive, plainBuffer);
            // execFileSync with an argument array - no shell string
            // interpolation, so no command-injection risk from the path.
            execFileSync(SEVEN_ZIP, ['x', tempArchive, '-o' + destDir, '-aou'], { stdio: 'inherit' });
            fs.unlinkSync(tempArchive);
            console.log(`Folder restored to: ${destDir}`);
        } else {
            const outPath = path.join(destDir, base);
            fs.writeFileSync(outPath, plainBuffer);
            console.log(`File restored: ${outPath}`);
        }

        console.log('\nDeleting vault file...');
        try {
            if (fs.existsSync(encFile)) {
                fs.unlinkSync(encFile);
                console.log('Vault file deleted successfully!');
            }
        } catch (e) {
            console.error('Could not delete vault file:', e.message);
        }

        const integrityFile = encFile + '.integrity';
        if (fs.existsSync(integrityFile)) {
            try {
                fs.unlinkSync(integrityFile);
                console.log('Integrity file deleted successfully!');
            } catch (e) {}
        }

        await sendAlert('DECRYPTION', {
            file: path.basename(encFile),
            location: destDir
        });

        logger.log('decrypt', { encFile, destDir });
        console.log('\nDECRYPTION COMPLETE!');
        console.log(`Files restored to: ${destDir}`);

    } catch (e) {
        console.error('Decryption failed:', e.message);
        process.exit(1);
    } finally {
        wipe(rawKey);
    }
}

main().catch(console.error);
