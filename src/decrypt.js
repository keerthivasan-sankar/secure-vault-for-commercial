#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { decryptBuffer, peekKeyKind, KEY_KIND, decryptWithPerFileKey } = require('./crypto');
const { loadMasterKey, loadDeviceKey } = require('./auth');
const { getDriveLetter, getSevenZipPath } = require('./platform');
const logger = require('./logger');
const { sendAlert } = require('./email-alert');
const { askHiddenPassword } = require('./password-input');

const SEVEN_ZIP = getSevenZipPath();

async function main() {
    const encFile = process.argv[2];
    const to = process.argv.includes('--to') ? process.argv[process.argv.indexOf('--to') + 1] : null;
    
    // Check if file is provided
    if (!encFile) {
        console.error('\n?? Secure Vault - Decryption');
        console.error('========================================');
        console.error('Usage: node decrypt.js <file.vault> [--to <folder>]');
        console.error('\nExamples:');
        console.error('  node decrypt.js secret.txt.vault');
        console.error('  node decrypt.js secret.txt.vault --to D:\\Restored');
        process.exit(1);
    }

    // Check if file exists
    if (!fs.existsSync(encFile)) {
        console.error(`\n? File not found: ${encFile}`);
        console.error('\n?? Search for .vault files:');
        console.error('   dir C:\\Users\\%USERNAME%\\Music\\*.vault');
        console.error('   dir C:\\Users\\%USERNAME%\\Desktop\\*.vault');
        console.error('   Get-ChildItem -Path C:\\Users\\%USERNAME% -Recurse -Filter "*.vault" -ErrorAction SilentlyContinue');
        process.exit(1);
    }

    console.log('\n?? Secure Vault - Decryption');
    console.log('========================================');
    console.log('?? Vault:', path.basename(encFile));

    const destDir = to ? path.resolve(to) : path.dirname(encFile);
    if (to) {
        fs.mkdirSync(destDir, { recursive: true });
        console.log(`?? Destination: ${destDir}`);
    }

    try {
        const raw = fs.readFileSync(encFile);
        const isNewFormat = raw.length > 44 && !raw.subarray(0, 4).equals(Buffer.from('SVLT'));

        let plainBuffer;
        let keyKind = KEY_KIND.MASTER;

        if (isNewFormat) {
            console.log('?? Detected new per-file key format');
            
            const originDrive = getDriveLetter(encFile);
            let usbKey;
            try {
                try {
                    usbKey = loadMasterKey();
                    console.log('? Master USB key verified');
                } catch (e) {
                    usbKey = loadDeviceKey(originDrive);
                    console.log(`? Device key for ${originDrive} verified`);
                }
            } catch (e) {
                console.error('?', e.message);
                process.exit(1);
            }

            console.log('\n?? Enter password: ');
            const password = await askHiddenPassword('');
            if (!password) {
                console.error('? Password required');
                process.exit(1);
            }

            const masterKey = Buffer.concat([Buffer.from(password, 'utf8'), usbKey]);

            try {
                plainBuffer = decryptWithPerFileKey(raw, masterKey);
            } catch (e) {
                console.error('? Decryption failed. Wrong password or corrupted file.');
                process.exit(1);
            }

        } else {
            console.log('?? Detected legacy format');
            const originDrive = getDriveLetter(encFile);
            keyKind = peekKeyKind(raw);
            console.log(`?? Key type: ${keyKind === KEY_KIND.MASTER ? 'Master' : 'Device'}`);

            let usbKey;
            try {
                if (keyKind === KEY_KIND.MASTER) {
                    usbKey = loadMasterKey();
                    console.log('? Master USB key verified');
                } else {
                    usbKey = loadDeviceKey(originDrive);
                    console.log(`? Device key for ${originDrive} verified`);
                }
            } catch (e) {
                console.error('?', e.message);
                process.exit(1);
            }

            console.log('\n?? Enter password: ');
            const password = await askHiddenPassword('');
            if (!password) {
                console.error('? Password required');
                process.exit(1);
            }

            const secret = Buffer.concat([Buffer.from(password, 'utf8'), usbKey]);

            try {
                const result = decryptBuffer(raw, secret);
                plainBuffer = result.plaintext;
                keyKind = result.keyKind;
            } catch (e) {
                console.error('? Decryption failed. Wrong password or corrupted file.');
                process.exit(1);
            }
        }

        // Restore file/folder
        const base = path.basename(encFile, '.vault');
        const isSevenZip = plainBuffer.length > 6 && 
            plainBuffer.subarray(0, 6).equals(Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]));

        if (isSevenZip) {
            console.log('\n?? Extracting folder...');
            const tempArchive = path.join(destDir, base + '.tmp.7z');
            fs.writeFileSync(tempArchive, plainBuffer);
            execSync(`"${SEVEN_ZIP}" x "${tempArchive}" -o"${destDir}" -aou`, { stdio: 'inherit' });
            fs.unlinkSync(tempArchive);
            console.log(`? Folder restored to: ${destDir}`);
        } else {
            const outPath = path.join(destDir, base);
            fs.writeFileSync(outPath, plainBuffer);
            console.log(`? File restored: ${outPath}`);
        }

        // Delete .vault file
        console.log('\n??? Deleting vault file...');
        try {
            if (fs.existsSync(encFile)) {
                fs.unlinkSync(encFile);
                console.log('? Vault file deleted successfully!');
            }
        } catch (e) {
            console.error('?? Could not delete vault file:', e.message);
        }

        // Delete checksum file
        const checksumFile = encFile + '.sha256';
        if (fs.existsSync(checksumFile)) {
            try {
                fs.unlinkSync(checksumFile);
                console.log('? Checksum file deleted successfully!');
            } catch (e) {}
        }

        await sendAlert('DECRYPTION', {
            file: path.basename(encFile),
            location: destDir
        });
        
        logger.log('decrypt', { encFile, destDir });
        console.log('\n? DECRYPTION COMPLETE!');
        console.log(`?? Files restored to: ${destDir}`);
        console.log('?? No trace left behind!');

    } catch (e) {
        console.error('? Decryption failed:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
