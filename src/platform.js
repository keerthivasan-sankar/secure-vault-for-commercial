#!/usr/bin/env node
const fs = require('fs');
const os = require('os');
const path = require('path');

function getSevenZipPath() {
    const platform = os.platform();
    const possiblePaths = [];
    
    if (platform === 'win32') {
        possiblePaths.push(
            'C:\\Program Files\\7-Zip\\7z.exe',
            'C:\\Program Files (x86)\\7-Zip\\7z.exe',
            'C:\\7zip\\7z.exe'
        );
    } else if (platform === 'darwin') {
        possiblePaths.push('/usr/local/bin/7z', '/opt/homebrew/bin/7z');
    } else if (platform === 'linux') {
        possiblePaths.push('/usr/bin/7z', '/usr/local/bin/7z');
    }
    
    for (const p of possiblePaths) {
        if (fs.existsSync(p)) return p;
    }
    
    try {
        const { execFileSync } = require('child_process');
        const [cmd, cmdArgs] = platform === 'win32' ? ['where', ['7z']] : ['which', ['7z']];
        const result = execFileSync(cmd, cmdArgs, { encoding: 'utf8' }).trim();
        if (result) return result;
    } catch (e) {}
    
    return '7z';
}

function getSystemDrive() {
    return process.env.SystemDrive || 'C:';
}

function getDriveLetter(targetPath) {
    const resolved = path.resolve(targetPath);
    const match = resolved.match(/^([A-Za-z]):/);
    if (!match) return null;
    return match[1].toUpperCase() + ':';
}

function isLocalDrive(driveLetter) {
    if (!driveLetter) return true;
    const systemDrive = getSystemDrive().toUpperCase();
    return driveLetter.toUpperCase() === systemDrive;
}

module.exports = {
    getSevenZipPath,
    getSystemDrive,
    getDriveLetter,
    isLocalDrive
};
