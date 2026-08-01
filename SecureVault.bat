@echo off
title ?? Secure Vault
color 0A
mode con: cols=80 lines=25

echo.
echo ========================================
echo   ?? SECURE VAULT
echo   Military-Grade Encryption
echo   Version 3.0.0
echo ========================================
echo.
echo Starting Secure Vault...
echo.
cd /d "%~dp0"
node secure-vault-launcher.js
