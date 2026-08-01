#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const crypto = require('crypto');
const { encryptWithPerFileKey, KEY_KIND } = require('./crypto');
const { loadMasterKey, loadDeviceKey } = require('./auth');
const { getDriveLetter, isLocalDrive, getSevenZipPath } = require('./platform');
const logger = require('./logger');
const { sendAlert } = require('./email-alert');
const BackupManager = require('./backup-manager');
const { generateChecksum, saveChecksum } = require('./checksum');
const { askHiddenPassword } = require('./password-input');

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
        console.log('? Secure delete completed (overwritten 3 times)');
    } catch (error) {
        console.error('?? Secure delete failed:', error.message);
        if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
    }
}

function showFilePreview(target) {
    const stats = fs.statSync(target);
    const isFile = stats.isFile();
    const size = stats.size;
    
    console.log('\n?? FILE PREVIEW');
    console.log('========================================');
    console.log(`?? Path: ${target}`);
    console.log(`?? Type: ${isFile ? 'File' : 'Folder'}`);
    console.log(`?? Size: ${formatSize(size)}`);
    console.log(`?? Modified: ${stats.mtime.toLocaleString()}`);
    
    if (isFile) {
        const ext = path.extname(target) || 'None';
        console.log(`?? Extension: ${ext}`);
        console.log(`?? Permissions: ${stats.mode.toString(8).slice(-3)}`);
        try {
            const sample = fs.readFileSync(target, 'utf8').slice(0, 100);
            console.log(`\n?? Preview (first 100 chars):`);
            console.log(`   ${sample}...`);
        } catch (e) {
            console.log('\n?? Preview: Binary file (preview not available)');
        }
    } else {
        const files = fs.readdirSync(target);
        console.log(`?? Contents: ${files.length} items`);
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

    const proceed = await askHiddenPassword('?? Proceed with encryption? (y/n): ');
    if (proceed.toLowerCase() !== 'y') {
        console.log('? Cancelled by user');
        process.exit(0);
    }

    console.log('\n?? Secure Vault - Encryption');
    console.log('========================================');
    console.log('?? Target:', target);

    const stat = fs.statSync(target);
    const drive = getDriveLetter(target);
    const local = isLocalDrive(drive);
    console.log(`?? Drive: ${drive} (${local ? 'Local' : 'External'})`);

    let usbKey, keyKind;
    try {
        if (local) {
            usbKey = loadMasterKey();
            keyKind = KEY_KIND.MASTER;
            console.log('? Master USB key verified');
        } else {
            usbKey = loadDeviceKey(drive);
            keyKind = KEY_KIND.DEVICE;
            console.log(`? Device key for ${drive} verified`);
        }
    } catch (e) {
        console.error('?', e.message);
        process.exit(1);
    }

    // ============================================
    // PASSWORD INPUT - 100% HIDDEN
    // ============================================
    console.log('\n?? Enter password (8+ chars): ');
    const password = await askHiddenPassword('');
    if (!password || password.length < 8) {
        console.error('? Password must be at least 8 characters');
        process.exit(1);
    }
    
    console.log('?? Confirm password: ');
    const confirm = await askHiddenPassword('');
    if (confirm !== password) {
        console.error('? Passwords do not match');
        process.exit(1);
    }

    const dir = path.dirname(target);
    const base = path.basename(target);
    const outPath = path.join(dir, base + VAULT_EXT);

    if (fs.existsSync(outPath)) {
        const overwrite = await askHiddenPassword('?? Vault exists. Overwrite? (y/n): ');
        if (overwrite.toLowerCase() !== 'y') {
            console.log('? Cancelled');
            process.exit(0);
        }
        fs.unlinkSync(outPath);
    }

    let plainBuffer;
    try {
        if (stat.isDirectory()) {
            console.log('?? Bundling folder...');
            const tempArchive = path.join(dir, base + '.tmp.7z');
            execSync(`"${SEVEN_ZIP}" a -t7z -mx=1 "${tempArchive}" "${target}"`, { stdio: 'ignore' });
            plainBuffer = fs.readFileSync(tempArchive);
            fs.unlinkSync(tempArchive);
        } else {
            plainBuffer = fs.readFileSync(target);
        }

        console.log('\n?? Creating encrypted backup...');
        const backupPath = backupManager.createBackup(target, password, usbKey);
        if (backupPath) {
            console.log(`? Backup created at: ${backupPath}`);
        }

        console.log('?? Encrypting with Per-File Key...');
        const masterKey = Buffer.concat([Buffer.from(password, 'utf8'), usbKey]);
        const encrypted = encryptWithPerFileKey(plainBuffer, masterKey);
        fs.writeFileSync(outPath, encrypted);

        console.log('?? Generating SHA-256 checksum...');
        const checksum = await generateChecksum(outPath);
        saveChecksum(outPath, checksum);
        console.log(`?? Checksum: ${checksum}`);

        console.log('\n??? Securely deleting original file/folder...');
        secureDelete(target);
        console.log('? Original securely deleted!');

        await sendAlert('ENCRYPTION', {
            file: path.basename(target),
            location: dir
        });
        
        logger.log('encrypt', { target, drive, keyKind: local ? 'master' : 'device' });
        console.log('\n? ENCRYPTION COMPLETE!');
        console.log(`?? Encrypted file: ${path.basename(outPath)}`);
        console.log(`?? Checksum file: ${path.basename(outPath)}.sha256`);
        console.log('?? Per-file key encryption used');

        backupManager.cleanupBackups();

    } catch (e) {
        console.error('? Encryption failed:', e.message);
        process.exit(1);
    }
}

main().catch(console.error);
