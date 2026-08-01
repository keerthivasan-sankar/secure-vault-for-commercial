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

function displayBackupContent(backupPath) {
    try {
        console.log('\n?? BACKUP FILE CONTENT');
        console.log('========================================');
        console.log(`?? File: ${path.basename(backupPath)}`);
        console.log(`?? Size: ${formatSize(fs.statSync(backupPath).size)}`);
        console.log(`?? Created: ${fs.statSync(backupPath).mtime.toLocaleString()}`);
        console.log('\n?? Content:');
        console.log('========================================\n');
        
        const content = fs.readFileSync(backupPath, 'utf8');
        console.log(content);
        
        console.log('\n========================================');
        console.log('?? End of backup file');
    } catch (error) {
        console.error('? Error reading backup:', error.message);
        console.log('\n?? This might be a binary file (image, video, etc.)');
        console.log('   Use "list" to see available backups');
    }
}

function displayAllBackups() {
    const report = backupManager.getBackupReport();
    
    console.log('\n?? ALL BACKUPS');
    console.log('========================================');
    console.log(`?? Total backups: ${report.total}`);
    if (report.total > 0) {
        console.log(`?? Total size: ${report.totalSize}`);
    }
    
    if (report.total === 0) {
        console.log('   ? No backups found');
        console.log('\n?? To create a backup, encrypt a file:');
        console.log('   node src/encrypt.js "C:\\path\\to\\file.txt"');
        return;
    }
    
    console.log('\n?? Available backups:');
    console.log('========================================');
    
    for (const backup of report.backups) {
        console.log(`\n?? ${backup.backup}`);
        console.log(`   ?? Original: ${backup.original}`);
        console.log(`   ?? Date: ${backup.timestamp}`);
        console.log(`   ?? Size: ${formatSize(backup.size)}`);
        console.log(`   ?? To view: node src/backup-viewer.js view "${backup.backup}"`);
    }
}

function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'list';

    console.log('\n??? Backup Viewer - Secure Vault');
    console.log('========================================');

    switch (command) {
        case 'list':
            displayAllBackups();
            break;

        case 'view':
            const backupName = args[1];
            if (!backupName) {
                console.error('? Usage: node src/backup-viewer.js view <backup-file>');
                console.error('   Example: node src/backup-viewer.js view secret.txt.2026-07-18T14-30-45-123Z.backup');
                process.exit(1);
            }
            
            const backupPath = path.join(backupManager.backupDir, backupName);
            if (!fs.existsSync(backupPath)) {
                console.error(`? Backup not found: ${backupName}`);
                console.log('\n?? Available backups:');
                console.log('   node src/backup-viewer.js list');
                process.exit(1);
            }
            
            displayBackupContent(backupPath);
            break;

        case 'view-latest':
            const report = backupManager.getBackupReport();
            if (report.total === 0) {
                console.log('? No backups found');
                process.exit(1);
            }
            const latest = report.backups[report.backups.length - 1];
            const latestPath = path.join(backupManager.backupDir, latest.backup);
            console.log(`?? Viewing latest backup: ${latest.backup}`);
            displayBackupContent(latestPath);
            break;

        default:
            console.log(`
Usage: node src/backup-viewer.js [command]

Commands:
  list              - List all backups
  view <filename>   - View a specific backup file
  view-latest       - View the latest backup

Examples:
  node src/backup-viewer.js list
  node src/backup-viewer.js view secret.txt.2026-07-18T14-30-45-123Z.backup
  node src/backup-viewer.js view-latest
            `);
    }
}

// Call main function
main();
