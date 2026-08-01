#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const BackupManager = require('./backup-manager');

const backupManager = new BackupManager();

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    return (bytes / 1073741824).toFixed(2) + ' GB';
}

function saveBackupAsText(backupName) {
    const backupPath = path.join(backupManager.backupDir, backupName);
    
    if (!fs.existsSync(backupPath)) {
        console.error(`? Backup not found: ${backupName}`);
        console.log('\n?? Available backups:');
        console.log('   node src/backup-viewer.js list');
        process.exit(1);
    }

    try {
        const content = fs.readFileSync(backupPath, 'utf8');
        const textFileName = backupName.replace('.backup', '.txt');
        const textFilePath = path.join(backupManager.backupDir, textFileName);
        
        const header = `========================================\n`;
        const header2 = `BACKUP FILE: ${backupName}\n`;
        const header3 = `CREATED: ${fs.statSync(backupPath).mtime.toLocaleString()}\n`;
        const header4 = `SIZE: ${formatSize(fs.statSync(backupPath).size)}\n`;
        const header5 = `========================================\n\n`;
        
        const fullContent = header + header2 + header3 + header4 + header5 + content;
        fs.writeFileSync(textFilePath, fullContent, 'utf8');
        
        console.log(`\n? Backup saved as text file!`);
        console.log(`?? Location: ${textFilePath}`);
        console.log(`?? Size: ${formatSize(fs.statSync(textFilePath).size)}`);
        console.log(`\n?? To open: notepad "${textFilePath}"`);
        
    } catch (error) {
        console.error('? Error saving backup:', error.message);
        console.log('\n?? This might be a binary file (image, video, etc.)');
    }
}

function saveAllBackupsAsText() {
    const report = backupManager.getBackupReport();
    
    if (report.total === 0) {
        console.log('? No backups found');
        return;
    }
    
    console.log(`\n?? Saving ${report.total} backup(s) as text files...`);
    console.log('========================================');
    
    let saved = 0;
    for (const backup of report.backups) {
        try {
            const backupPath = path.join(backupManager.backupDir, backup.backup);
            const content = fs.readFileSync(backupPath, 'utf8');
            
            const textFileName = backup.backup.replace('.backup', '.txt');
            const textFilePath = path.join(backupManager.backupDir, textFileName);
            
            const header = `========================================\n`;
            const header2 = `BACKUP: ${backup.backup}\n`;
            const header3 = `ORIGINAL: ${backup.original}\n`;
            const header4 = `DATE: ${backup.timestamp}\n`;
            const header5 = `SIZE: ${formatSize(backup.size)}\n`;
            const header6 = `========================================\n\n`;
            
            const fullContent = header + header2 + header3 + header4 + header5 + header6 + content;
            fs.writeFileSync(textFilePath, fullContent, 'utf8');
            saved++;
            console.log(`? ${backup.backup} ? ${textFileName}`);
        } catch (e) {
            console.log(`?? Skipped ${backup.backup} (binary file)`);
        }
    }
    
    console.log(`\n? Saved ${saved} backup(s) as text files!`);
    console.log(`?? Location: ${backupManager.backupDir}`);
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    console.log('\n?? Backup Text Saver - Secure Vault');
    console.log('========================================');

    switch (command) {
        case 'save':
            const backupName = args[1];
            if (!backupName) {
                console.error('? Usage: node src/backup-saver.js save <backup-file>');
                console.error('   Example: node src/backup-saver.js save secret.txt.2026-07-18T14-30-45-123Z.backup');
                process.exit(1);
            }
            saveBackupAsText(backupName);
            break;

        case 'save-all':
            saveAllBackupsAsText();
            break;

        default:
            console.log(`
Usage: node src/backup-saver.js [command]

Commands:
  save <filename>   - Save a specific backup as text
  save-all          - Save ALL backups as text

Examples:
  node src/backup-saver.js save secret.txt.2026-07-18T14-30-45-123Z.backup
  node src/backup-saver.js save-all
            `);
    }
}

// Call main function
main();
