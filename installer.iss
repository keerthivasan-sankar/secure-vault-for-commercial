; Secure Vault - Inno Setup installer script
; Build with: iscc installer.iss   (Inno Setup 6.x, https://jrsoftware.org/isinfo.php)
; Produces: dist/SecureVaultSetup-<version>.exe

#define MyAppName "Secure Vault"
#define MyAppVersion "3.5.0"
#define MyAppPublisher "Keerthivasan S"
#define MyAppURL "https://github.com/keerthivasan-sankar/secure-vault-for-commercial"
#define MyAppExeName "secure-vault.bat"

[Setup]
AppId={{8F3C1B2A-6D4E-4A9C-9F1D-2C7E5A0B9E11}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\SecureVault
DefaultGroupName=Secure Vault
DisableProgramGroupPage=yes
OutputDir=dist
OutputBaseFilename=SecureVaultSetup-{#MyAppVersion}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
; Requires admin rights so Node.js / 7-Zip can be installed if missing,
; and so shortcuts/right-click registration work for all users.
PrivilegesRequired=admin
ArchitecturesInstallIn64BitMode=x64compatible
UninstallDisplayIcon={app}\icon.ico
SetupIconFile=icon.ico
; LicenseFile=LICENSE.txt   ; uncomment once you add a LICENSE.txt

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Additional shortcuts:"
Name: "rightclick"; Description: "Add ""Encrypt/Decrypt with Secure Vault"" to the right-click menu"; GroupDescription: "Additional shortcuts:"; Flags: unchecked

[Files]
Source: "package.json"; DestDir: "{app}"; Flags: ignoreversion
Source: "secure-vault.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "SecureVault.bat"; DestDir: "{app}"; Flags: ignoreversion
Source: "secure-vault-launcher.js"; DestDir: "{app}"; Flags: ignoreversion
Source: "README.txt"; DestDir: "{app}"; Flags: ignoreversion
Source: "src\*"; DestDir: "{app}\src"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "config\*"; DestDir: "{app}\config"; Flags: ignoreversion recursesubdirs createallsubdirs onlyifdoesntexist
; icon.ico must exist alongside this script before building - see PUBLISH_CHECKLIST.md
Source: "icon.ico"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
Name: "{group}\Secure Vault"; Filename: "cmd.exe"; Parameters: "/c ""cd /d ""{app}"" && secure-vault.bat"""; IconFilename: "{app}\icon.ico"
Name: "{group}\Uninstall Secure Vault"; Filename: "{uninstallexe}"
Name: "{autodesktop}\Secure Vault"; Filename: "cmd.exe"; Parameters: "/c ""cd /d ""{app}"" && secure-vault.bat"""; IconFilename: "{app}\icon.ico"; Tasks: desktopicon

[Run]
; Check for Node.js and install silently if missing (same logic as the old Install.bat)
Filename: "powershell.exe"; Parameters: "-NoProfile -ExecutionPolicy Bypass -Command ""if (-not (Get-Command node -ErrorAction SilentlyContinue)) {{ Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.11.0/node-v20.11.0-x64.msi' -OutFile \""$env:TEMP\node-installer.msi\""; Start-Process msiexec -ArgumentList '/i', \""$env:TEMP\node-installer.msi\"", '/quiet' -Wait; Remove-Item \""$env:TEMP\node-installer.msi\"" }}"""; StatusMsg: "Checking for Node.js..."; Flags: runhidden waituntilterminated

; Install npm dependencies
Filename: "{cmd}"; Parameters: "/c cd /d ""{app}"" && npm install --silent --no-fund --no-audit"; StatusMsg: "Installing dependencies..."; Flags: runhidden waituntilterminated

; Optional right-click integration
Filename: "node.exe"; Parameters: """{app}\src\install-rightclick.js"""; WorkingDir: "{app}"; StatusMsg: "Registering right-click menu..."; Tasks: rightclick; Flags: runhidden waituntilterminated

; Launch after install
Filename: "cmd.exe"; Parameters: "/c ""cd /d ""{app}"" && secure-vault.bat"""; Description: "Launch Secure Vault"; Flags: postinstall nowait skipifsilent

[UninstallDelete]
Type: filesandordirs; Name: "{app}\node_modules"
