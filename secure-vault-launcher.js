#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const command = args[0] || 'help';

if (command === 'help' || !command) {
    console.log(`
================================================
           SECURE VAULT - CLI
================================================
  encrypt <file>          Encrypt a file/folder
  decrypt <file>          Decrypt a .vault file
  register <type> <drive> Register USB key (master/device)
  devices                 List registered USB devices
  backup list             View all backups
  backup view <name>      View a specific backup
  backup view-latest      View the most recent backup
  restore list            List restorable files
  restore restore <file>  Restore a file from backup
  email                   Configure email alerts
  rightclick              Install right-click menu
  help                    Show this help
================================================
    `);
    process.exit(0);
}

function runScript(scriptName, scriptArgs) {
    const scriptPath = path.join(__dirname, 'src', scriptName);
    if (!fs.existsSync(scriptPath)) {
        console.error(`Script not found: ${scriptName}`);
        process.exit(1);
    }
    const child = spawn('node', [scriptPath, ...scriptArgs], { stdio: 'inherit' });
    child.on('close', (code) => {
        process.exit(code);
    });
}

const scriptMap = {
    'encrypt': 'encrypt.js',
    'decrypt': 'decrypt.js',
    'register': 'register.js',
    'devices': 'devices.js',
    'backup': 'backup-viewer.js',
    'restore': 'restore.js',
    'email': 'email-alert.js',
    'rightclick': 'install-rightclick.js'
};

if (scriptMap[command]) {
    const scriptArgs = args.slice(1);
    runScript(scriptMap[command], scriptArgs);
} else {
    console.log('Unknown command:', command);
    console.log('   Type: secure-vault help');
}
