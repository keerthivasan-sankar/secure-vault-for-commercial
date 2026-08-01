@echo off
title Secure Vault Installer
color 0A
setlocal enabledelayedexpansion

echo.
echo ========================================
echo   SECURE VAULT v3.2.0
echo   Military-Grade Encryption
echo ========================================
echo.
echo This will install Secure Vault on your system.
echo.

:: ============================================
:: STEP 1: Check Node.js
:: ============================================
echo [1/5] Checking Node.js...
where node >nul 2>&1
if errorlevel 1 (
    echo Node.js not found - Installing...
    echo Please wait...
    powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile '%TEMP%\node-installer.msi'"
    start /wait msiexec /i "%TEMP%\node-installer.msi" /quiet
    del "%TEMP%\node-installer.msi"
    echo Node.js installed!
) else (
    echo Node.js found!
)
echo.

:: ============================================
:: STEP 2: Check 7-Zip
:: ============================================
echo [2/5] Checking 7-Zip...
if exist "C:\Program Files\7-Zip\7z.exe" (
    echo 7-Zip found!
) else (
    echo 7-Zip not found - Installing...
    echo Please wait...
    powershell -Command "Invoke-WebRequest -Uri 'https://www.7-zip.org/a/7z2409-x64.exe' -OutFile '%TEMP%\7zip-installer.exe'"
    start /wait %TEMP%\7zip-installer.exe /S
    del "%TEMP%\7zip-installer.exe"
    echo 7-Zip installed!
)
echo.

:: ============================================
:: STEP 3: Install Secure Vault
:: ============================================
echo [3/5] Installing Secure Vault...
set INSTALL_DIR=%LOCALAPPDATA%\SecureVault
if exist "%INSTALL_DIR%" (
    echo Removing old installation...
    rmdir /s /q "%INSTALL_DIR%"
)
mkdir "%INSTALL_DIR%"
echo Created: %INSTALL_DIR%

:: Copy files from the same folder as the installer
echo Copying files...
xcopy /E /I /Y "%~dp0src" "%INSTALL_DIR%\src" >nul
xcopy /E /I /Y "%~dp0config" "%INSTALL_DIR%\config" >nul
copy "%~dp0package.json" "%INSTALL_DIR%" >nul
copy "%~dp0SecureVault.bat" "%INSTALL_DIR%" >nul
copy "%~dp0secure-vault.bat" "%INSTALL_DIR%" >nul
copy "%~dp0secure-vault-launcher.js" "%INSTALL_DIR%" >nul
copy "%~dp0README.txt" "%INSTALL_DIR%" >nul

if errorlevel 1 (
    echo ERROR: Failed to copy files!
    pause
    exit /b 1
)
echo Files copied!
echo.

:: ============================================
:: STEP 4: Install NPM Dependencies
:: ============================================
echo [4/5] Installing npm dependencies...
cd /d "%INSTALL_DIR%"
call npm install --silent --no-fund --no-audit >nul 2>&1
echo NPM dependencies installed!
echo.

:: ============================================
:: STEP 5: Create Shortcuts
:: ============================================
echo [5/5] Creating shortcuts...

:: Desktop shortcut
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('$env:USERPROFILE\Desktop\Secure Vault.lnk'); $Shortcut.TargetPath = 'C:\Windows\System32\cmd.exe'; $Shortcut.Arguments = '/c \"cd /d %INSTALL_DIR% && secure-vault.bat\"'; $Shortcut.IconLocation = 'C:\Program Files\7-Zip\7z.exe,0'; $Shortcut.Save()"
echo Desktop shortcut created!

:: Start Menu shortcut
set STARTMENU=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Secure Vault
mkdir "%STARTMENU%" 2>nul
powershell -Command "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Secure Vault\Secure Vault.lnk'); $Shortcut.TargetPath = 'C:\Windows\System32\cmd.exe'; $Shortcut.Arguments = '/c \"cd /d %INSTALL_DIR% && secure-vault.bat\"'; $Shortcut.Save()"
echo Start Menu entry created!

echo.
echo ========================================
echo   INSTALLATION COMPLETE!
echo ========================================
echo.
echo Installed to: %INSTALL_DIR%
echo Desktop shortcut: Secure Vault
echo.
echo Launching Secure Vault...
start "" "%INSTALL_DIR%\secure-vault.bat"

echo.
echo This window will close automatically...
timeout /t 3 /nobreak >nul
exit
