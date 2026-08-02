#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const SECURE_VAULT_PATH = path.join(__dirname, '..');
const REG_PATH = path.join(__dirname, '..', 'install-rightclick.reg');

const regContent = `Windows Registry Editor Version 5.00

; ENCRYPT - Right-click any file
[HKEY_CLASSES_ROOT\\*\\shell\\SecureEncrypt]
@="?? Encrypt with USB"
"Icon"="C:\\\\Program Files\\\\7-Zip\\\\7z.exe"

[HKEY_CLASSES_ROOT\\*\\shell\\SecureEncrypt\\command]
@="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command \"cd '${SECURE_VAULT_PATH}'; node src/encrypt.js '%1'\""

; ENCRYPT - Right-click any folder
[HKEY_CLASSES_ROOT\\Directory\\shell\\SecureEncrypt]
@="?? Encrypt with USB"
"Icon"="C:\\\\Program Files\\\\7-Zip\\\\7z.exe"

[HKEY_CLASSES_ROOT\\Directory\\shell\\SecureEncrypt\\command]
@="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command \"cd '${SECURE_VAULT_PATH}'; node src/encrypt.js '%1'\""

; DECRYPT - Right-click .vault files
[HKEY_CLASSES_ROOT\\.vault\\shell\\SecureDecrypt]
@="?? Decrypt with USB"
"Icon"="C:\\\\Program Files\\\\7-Zip\\\\7z.exe"

[HKEY_CLASSES_ROOT\\.vault\\shell\\SecureDecrypt\\command]
@="powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -Command \"cd '${SECURE_VAULT_PATH}'; node src/decrypt.js '%1'\""
`;

fs.writeFileSync(REG_PATH, regContent);
console.log('? Registry file created');

execFileSync('regedit', ['/s', REG_PATH], { stdio: 'ignore' });
console.log('? Right-click menu installed!');

fs.unlinkSync(REG_PATH);
console.log('? Done!');
console.log('\n?? Right-click options added:');
console.log('   ?? Encrypt with USB (files/folders)');
console.log('   ?? Decrypt with USB (.vault files)');
