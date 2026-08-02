#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const crypto = require('crypto');
const { encryptWithPerFileKey, KEY_KIND, wipe } = require('./crypto');
const { loadMasterKey, loadDeviceKey } = require('./auth');
const { getDriveLetter, isLocalDrive, getSevenZipPath } = require('./platform');
const logger = require('./logger');
const { sendAlert } = require('./email-alert');
const BackupManager = require('./backup-manager');
const { generateHmac, saveHmac } = require('./checksum');
const { askHiddenPassword, askSecret } = require('./password-input');

const SEVEN_ZIP = getSevenZipPath();
const VAULT_EXT = '.vault';
const backupManager = new BackupManager();

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function secureDelete(filePath, passes = 3) {
    try {
        if (!fs.existsSync(filePath)) return;
        const stats = fs.statSync(filePath);
        const size = stats.size;

        if (stats.isDirectory()) {
            const files = fs.readdirSync(filePath);
            for (const file of files) {
                secureDelete(path.join(filePath, file), passes);
            }
            fs.rmdirSync(filePath);
            return;
        }

        const fd = fs.openSync(filePath, 'r+');
        for (let pass = 0; pass < passes; pass++) {
            const randomData = crypto.randomBytes(size);
            fs.writeSync(fd, randomData, 0, size, 0);
            fs.fsyncSync(fd);
            if (pass === 0) {
                const zeros = Buffer.alloc(size, 0);
                fs.writeSync(fd, zeros, 0, size, 0);
                fs.fsyncSync(fd);
            }
        }
        fs.closeSync(fd);
        fs.unlinkSync(filePath);
        console.log('Secure delete completed (overwritten 3 times)');
    } catch (error) {
        console.error('Secure delete failed:', error.message);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

function showFilePreview(target) {
    const stats = fs.statSync(target);
    const isFile = stats.isFile();
    const size = stats.size;

    console.log('\nFILE PREVIEW');
    console.log('========================================');
    console.log(`Path: ${target}`);
    console.log(`Type: ${isFile ? 'File' : 'Folder'}`);
    console.log(`Size: ${formatSize(size)}`);
    console.log(`Modified: ${stats.mtime.toLocaleString()}`);

    if (isFile) {
        const ext = path.extname(target) || 'None';
        console.log(`Extension: ${ext}`);
        console.log(`Permissions: ${stats.mode.toString(8).slice(-3)}`);
        try {
            const sample = fs.readFileSync(target, 'utf8').slice(0, 100);
            console.log(`\nPreview (first 100 chars):`);
            console.log(`   ${sample}...`);
        } catch (e) {
            console.log('\nPreview: Binary file (preview not available)');
        }
    } else {
        const files = fs.readdirSync(target);
        console.log(`Contents: ${files.length} items`);
        const maxShow = 10;
        for (let i = 0; i < Math.min(files.length, maxShow); i++) {
            console.log(`   - ${files[i]}`);
        }
        if (files.length > maxShow) {
            console.log(`   ... and ${files.length - maxShow} more files`);
        }
    }
    console.log('\n========================================');
}

async function main() {
    const target = process.argv[2];
    if (!target || !fs.existsSync(target)) {
        console.error('Usage: node encrypt.js <file-or-folder>');
        process.exit(1);
    }

    showFilePreview(target);

    const proceed = await askHiddenPassword('Proceed with encryption? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
        console.log('Cancelled by user');
        process.exit(0);
    }

    console.log('\nSecure Vault - Encryption');
    console.log('========================================');
    console.log('Target:', target);

    const stat = fs.statSync(target);
    const drive = getDriveLetter(target);
    const local = isLocalDrive(drive);
    console.log(`Drive: ${drive} (${local ? 'Local' : 'External'})`);

    // ============================================
    // PASSWORD INPUT - required to unwrap the USB key.
    // Held as a Buffer (not a string) so it can be explicitly wiped below.
    // ============================================
    console.log('\nEnter password (8+ chars):');
    console.log('IMPORTANT: There is no password recovery. If you forget this');
    console.log('password, your files are permanently unrecoverable - even with');
    console.log('the USB key. Consider storing it in a password manager.');
    const passwordBuf = await askSecret('');
    if (!passwordBuf || passwordBuf.length < 8) {
        wipe(passwordBuf);
        console.error('Password must be at least 8 characters');
        process.exit(1);
    }

    console.log('Confirm password:');
    const confirmBuf = await askSecret('');
    const matches = passwordBuf.length === confirmBuf.length &&
        crypto.timingSafeEqual(passwordBuf, confirmBuf);
    wipe(confirmBuf);
    if (!matches) {
        wipe(passwordBuf);
        console.error('Passwords do not match');
        process.exit(1);
    }

    let rawKey, keyKind;
    try {
        if (local) {
            rawKey = loadMasterKey(passwordBuf);
            keyKind = KEY_KIND.MASTER;
            console.log('Master USB key unlocked');
        } else {
            rawKey = loadDeviceKey(drive, passwordBuf);
            keyKind = KEY_KIND.DEVICE;
            console.log(`Device key for ${drive} unlocked`);
        }
    } catch (e) {
        wipe(passwordBuf);
        console.error(e.message);
        process.exit(1);
    }
    wipe(passwordBuf);

    const dir = path.dirname(target);
    const base = path.basename(target);
    const outPath = path.join(dir, base + VAULT_EXT);

    if (fs.existsSync(outPath)) {
        const overwrite = await askHiddenPassword('Vault exists. Overwrite? (y/n): ');
        if (overwrite.toLowerCase() !== 'y') {
            wipe(rawKey);
            console.log('Cancelled');
            process.exit(0);
        }
        fs.unlinkSync(outPath);
    }

    let plainBuffer;
    try {
        if (stat.isDirectory()) {
            console.log('Bundling folder...');
            const tempArchive = path.join(dir, base + '.tmp.7z');
            // execFileSync passes arguments as an array - no shell parsing,
            // so a crafted file/folder name cannot break out of quoting
            // and inject extra commands the way execSync + a template
            // string could.
            execFileSync(SEVEN_ZIP, ['a', '-t7z', '-mx=1', tempArchive, target], { stdio: 'ignore' });
            plainBuffer = fs.readFileSync(tempArchive);
            fs.unlinkSync(tempArchive);
        } else {
            plainBuffer = fs.readFileSync(target);
        }

        console.log('\nCreating encrypted backup...');
        const backupPath = backupManager.createBackup(target, rawKey);
        if (backupPath) {
            console.log(`Backup created at: ${backupPath}`);
        }

        console.log('Encrypting with per-file key...');
        const encrypted = encryptWithPerFileKey(plainBuffer, rawKey);
        fs.writeFileSync(outPath, encrypted);

        console.log('Generating integrity HMAC...');
        const mac = await generateHmac(outPath, rawKey);
        saveHmac(outPath, mac);
        console.log(`Integrity HMAC: ${mac}`);

        console.log('\nSecurely deleting original file/folder...');
        secureDelete(target);
        console.log('Original securely deleted!');

        await sendAlert('ENCRYPTION', {
            file: path.basename(target),
            location: dir
        });

        logger.log('encrypt', { target, drive, keyKind: local ? 'master' : 'device' });
        console.log('\nENCRYPTION COMPLETE!');
        console.log(`Encrypted file: ${path.basename(outPath)}`);
        console.log(`Integrity file: ${path.basename(outPath)}.integrity`);
        console.log('Per-file key encryption used');

        backupManager.cleanupBackups();

    } catch (e) {
        console.error('Encryption failed:', e.message);
        process.exit(1);
    } finally {
        wipe(rawKey);
    }
}

main().catch(console.error);
