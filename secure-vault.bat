@echo off
title Secure Vault
color 0A
setlocal enabledelayedexpansion

:MENU
cls
echo.
echo ========================================
echo   SECURE VAULT v3.2.0
echo   Military-Grade Encryption
echo ========================================
echo.
echo   1. Encrypt a file/folder
echo   2. Decrypt a .vault file
echo   3. Register USB key
echo   4. List USB devices
echo   5. View backups
echo   6. Restore from backup
echo   7. Configure email
echo   8. Install right-click menu
echo   9. Exit
echo.
echo ========================================
echo.

set /p choice="Enter your choice (1-9): "

if "%choice%"=="1" goto ENCRYPT
if "%choice%"=="2" goto DECRYPT
if "%choice%"=="3" goto REGISTER
if "%choice%"=="4" goto DEVICES
if "%choice%"=="5" goto BACKUP
if "%choice%"=="6" goto RESTORE
if "%choice%"=="7" goto EMAIL
if "%choice%"=="8" goto RIGHTCLICK
if "%choice%"=="9" goto EXIT
echo Invalid choice!
pause
goto MENU

:ENCRYPT
cls
echo.
echo ========================================
echo   ENCRYPT
echo ========================================
echo.
set /p file="Enter file/folder path: "
if "%file%"=="" goto ENCRYPT
echo.
echo Encrypting...
node "%~dp0src\encrypt.js" "%file%"
echo.
pause
goto MENU

:DECRYPT
cls
echo.
echo ========================================
echo   DECRYPT
echo ========================================
echo.
set /p file="Enter .vault file path: "
if "%file%"=="" goto DECRYPT
echo.
echo Decrypting...
node "%~dp0src\decrypt.js" "%file%"
echo.
pause
goto MENU

:REGISTER
cls
echo.
echo ========================================
echo   REGISTER USB
echo ========================================
echo.
set /p type="Enter type (master/device): "
if "%type%"=="" goto REGISTER
set /p drive="Enter drive (D:\): "
if "%drive%"=="" goto REGISTER
echo.
echo Registering...
node "%~dp0src\register.js" %type% %drive%
echo.
pause
goto MENU

:DEVICES
cls
echo.
echo ========================================
echo   LIST USB DEVICES
echo ========================================
echo.
node "%~dp0src\devices.js"
echo.
pause
goto MENU

:BACKUP
cls
echo.
echo ========================================
echo   VIEW BACKUPS
echo ========================================
echo.
node "%~dp0src\backup-viewer.js" list
echo.
pause
goto MENU

:RESTORE
cls
echo.
echo ========================================
echo   RESTORE FROM BACKUP
echo ========================================
echo.
set /p file="Enter file to restore: "
if "%file%"=="" goto RESTORE
echo.
echo Restoring...
node "%~dp0src\restore.js" restore "%file%"
echo.
pause
goto MENU

:EMAIL
cls
echo.
echo ========================================
echo   CONFIGURE EMAIL
echo ========================================
echo.
node "%~dp0src\email-alert.js"
echo.
pause
goto MENU

:RIGHTCLICK
cls
echo.
echo ========================================
echo   INSTALL RIGHT-CLICK MENU
echo ========================================
echo.
node "%~dp0src\install-rightclick.js"
echo.
pause
goto MENU

:EXIT
cls
echo.
echo ========================================
echo   GOODBYE!
echo ========================================
echo.
echo Thank you for using Secure Vault!
echo.
timeout /t 2 /nobreak >nul
exit
