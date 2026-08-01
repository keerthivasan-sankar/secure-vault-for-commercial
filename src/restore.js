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
        console.log(`   ?? To restore: node src/restore.js restore "${backup.original}"`);
    }
}

function restoreBackup(filePath) {
    if (!fs.existsSync(filePath)) {
        const backupName = path.basename(filePath);
        const backupPath = path.join(backupManager.backupDir, backupName);
        
        if (fs.existsSync(backupPath)) {
            try {
                const restorePath = filePath.replace('.backup', '');
                fs.copyFileSync(backupPath, restorePath);
                console.log(`\n? File restored to: ${restorePath}`);
                console.log(`?? Restored from: ${backupName}`);
                return;
            } catch (e) {
                console.error('? Restore failed:', e.message);
                return;
            }
        }
        
        console.error(`? File not found: ${filePath}`);
        console.log('\n?? Available backups:');
        console.log('   node src/restore.js list');
        return;
    }
    
    const backups = backupManager.getBackups(filePath);
    if (backups.length === 0) {
        console.log(`? No backups found for: ${path.basename(filePath)}`);
        console.log('\n?? Available backups:');
        console.log('   node src/restore.js list');
        return;
    }
    
    console.log(`\n?? Found ${backups.length} backup(s) for: ${path.basename(filePath)}`);
    console.log('========================================');
    
    for (let i = 0; i < backups.length; i++) {
        console.log(`   ${i + 1}. ${backups[i]}`);
    }
    
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    
    rl.question('\n?? Select backup number (1-' + backups.length + '): ', (answer) => {
        rl.close();
        const index = parseInt(answer) - 1;
        if (isNaN(index) || index < 0 || index >= backups.length) {
            console.log('? Invalid selection');
            return;
        }
        
        const selectedBackup = backups[index];
        const backupPath = path.join(backupManager.backupDir, selectedBackup);
        
        try {
            fs.copyFileSync(backupPath, filePath);
            console.log(`\n? File restored to: ${filePath}`);
            console.log(`?? Restored from: ${selectedBackup}`);
        } catch (e) {
            console.error('? Restore failed:', e.message);
        }
    });
}

async function main() {
    const args = process.argv.slice(2);
    const command = args[0] || 'list';

    console.log('\n?? Secure Vault - Restore Manager');
    console.log('========================================');

    switch (command) {
        case 'list':
            displayAllBackups();
            break;

        case 'restore':
            if (!args[1]) {
                console.error('? Usage: node src/restore.js restore <file-path>');
                console.error('   Example: node src/restore.js restore "C:\\Users\\%USERNAME%\\Desktop\\file.txt"');
                process.exit(1);
            }
            restoreBackup(args[1]);
            break;

        default:
            console.log(`
Usage: node src/restore.js [command]

Commands:
  list              - List all backups
  restore <file>    - Restore a file from backup

Examples:
  node src/restore.js list
  node src/restore.js restore "C:\\Users\\%USERNAME%\\Desktop\\file.txt"
            `);
    }
}

main().catch(console.error);
