const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

class BackupManager {
    constructor() {
        this.backupDir = path.join(__dirname, '..', 'backups');
        this.maxBackups = 5;
        this.maxAge = 30;
        this.encryptBackups = true;
    }

    createBackup(filePath, password = null, usbKey = null) {
        try {
            if (!fs.existsSync(this.backupDir)) {
                fs.mkdirSync(this.backupDir, { recursive: true });
            }

            const fileName = path.basename(filePath);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupName = `${fileName}.${timestamp}.backup`;
            const backupPath = path.join(this.backupDir, backupName);

            const plaintext = fs.readFileSync(filePath);
            let backupData = plaintext;

            if (this.encryptBackups && password && usbKey) {
                const salt = crypto.randomBytes(16);
                const backupKey = crypto.scryptSync(
                    Buffer.concat([Buffer.from(password, 'utf8'), usbKey, Buffer.from('BACKUP')]),
                    salt,
                    32
                );
                const iv = crypto.randomBytes(12);
                const cipher = crypto.createCipheriv('aes-256-gcm', backupKey, iv);
                const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
                const authTag = cipher.getAuthTag();
                backupData = Buffer.concat([salt, iv, authTag, ciphertext]);
            }

            fs.writeFileSync(backupPath, backupData);
            this.logBackup(filePath, backupPath);
            console.log(`? Backup created: ${backupName}${this.encryptBackups ? ' (encrypted)' : ''}`);
            return backupPath;
        } catch (error) {
            console.error('? Backup failed:', error.message);
            return null;
        }
    }

    restoreBackup(filePath, password = null, usbKey = null) {
        try {
            const fileName = path.basename(filePath);
            const backups = this.getBackups(filePath);
            if (backups.length === 0) {
                console.log('? No backups found for:', fileName);
                return null;
            }

            const latest = backups[0];
            const backupPath = path.join(this.backupDir, latest);
            const backupData = fs.readFileSync(backupPath);
            let plaintext = backupData;

            if (this.encryptBackups && password && usbKey) {
                try {
                    const salt = backupData.subarray(0, 16);
                    const iv = backupData.subarray(16, 28);
                    const authTag = backupData.subarray(28, 44);
                    const ciphertext = backupData.subarray(44);

                    const backupKey = crypto.scryptSync(
                        Buffer.concat([Buffer.from(password, 'utf8'), usbKey, Buffer.from('BACKUP')]),
                        salt,
                        32
                    );

                    const decipher = crypto.createDecipheriv('aes-256-gcm', backupKey, iv);
                    decipher.setAuthTag(authTag);
                    plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
                } catch (e) {
                    console.log('?? Backup decryption failed. Trying as plaintext...');
                    plaintext = backupData;
                }
            }

            fs.writeFileSync(filePath, plaintext);
            console.log(`? Restored from: ${latest}`);
            return filePath;
        } catch (error) {
            console.error('? Restore failed:', error.message);
            return null;
        }
    }

    getBackups(filePath) {
        if (!fs.existsSync(this.backupDir)) return [];
        const fileName = path.basename(filePath);
        return fs.readdirSync(this.backupDir)
            .filter(f => f.startsWith(fileName) && f.endsWith('.backup'))
            .sort().reverse();
    }

    cleanupBackups() {
        try {
            if (!fs.existsSync(this.backupDir)) return;
            const files = fs.readdirSync(this.backupDir);
            const now = Date.now();
            const maxAgeMs = this.maxAge * 24 * 60 * 60 * 1000;
            const groups = {};
            for (const file of files) {
                if (!file.endsWith('.backup')) continue;
                const baseName = file.split('.')[0];
                if (!groups[baseName]) groups[baseName] = [];
                groups[baseName].push(file);
            }
            for (const [file, backups] of Object.entries(groups)) {
                backups.sort().reverse();
                for (let i = this.maxBackups; i < backups.length; i++) {
                    const backupPath = path.join(this.backupDir, backups[i]);
                    fs.unlinkSync(backupPath);
                    console.log(`??? Removed old backup: ${backups[i]}`);
                }
                for (const backup of backups) {
                    const backupPath = path.join(this.backupDir, backup);
                    const stats = fs.statSync(backupPath);
                    if (now - stats.mtimeMs > maxAgeMs) {
                        fs.unlinkSync(backupPath);
                        console.log(`??? Removed expired backup: ${backup}`);
                    }
                }
            }
        } catch (error) {
            console.error('?? Cleanup error:', error.message);
        }
    }

    logBackup(originalPath, backupPath) {
        const logFile = path.join(this.backupDir, 'backup_log.json');
        let log = [];
        if (fs.existsSync(logFile)) {
            try { log = JSON.parse(fs.readFileSync(logFile, 'utf8')); } catch (e) {}
        }
        log.push({
            original: originalPath,
            backup: path.basename(backupPath),
            timestamp: new Date().toISOString(),
            size: fs.statSync(originalPath).size
        });
        fs.writeFileSync(logFile, JSON.stringify(log, null, 2));
    }

    getBackupReport() {
        const logFile = path.join(this.backupDir, 'backup_log.json');
        if (!fs.existsSync(logFile)) return { total: 0, backups: [] };
        try {
            const log = JSON.parse(fs.readFileSync(logFile, 'utf8'));
            const totalSize = log.reduce((sum, entry) => sum + entry.size, 0);
            return { total: log.length, totalSize: this.formatBytes(totalSize), backups: log };
        } catch (e) { return { total: 0, backups: [] }; }
    }

    formatBytes(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
        if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
        return (bytes / 1073741824).toFixed(2) + ' GB';
    }
}

module.exports = BackupManager;
