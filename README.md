# Secure Vault

<p align="center">
  <img src="assets/logo.png" alt="Secure Vault logo" width="280">
</p>

A local-first file encryption tool for Windows that uses a **physical USB drive as your key** — not just a password. Encrypted files can only be decrypted with the same registered USB drive plugged in.

## Why a USB key instead of just a password?

Passwords can be guessed, phished, or brute-forced. Secure Vault instead generates a random 256-bit key and stores it on a USB drive you choose. To decrypt anything, that exact drive has to be physically present. This means:

- Someone who steals your laptop (but not your USB drive) cannot decrypt your files.
- There's no password to remember or leak.
- **You must keep that USB drive safe.** If you lose it and have no backup copy of the key file, your encrypted files are unrecoverable. There is no password reset.

## Features

- AES-256-GCM encryption with scrypt key derivation
- USB-based master key + optional per-device keys
- Encrypted local backups with automatic rotation
- File integrity checksums
- Multi-pass secure delete of originals after encryption
- Optional email alerts on vault activity
- Right-click "Encrypt/Decrypt with Secure Vault" Windows Explorer integration

## Installation

1. Download the latest `SecureVaultSetup-x.x.x.exe` from the [Releases](../../releases) page.
2. Run it. Windows may show a SmartScreen warning until this build has enough downloads to establish reputation — see [PUBLISH_CHECKLIST.md](PUBLISH_CHECKLIST.md) for how this gets resolved via code signing.
3. Follow the setup wizard. Node.js will be installed automatically if it isn't already on your system.
4. Launch **Secure Vault** from the Start Menu or Desktop shortcut.
5. On first run, register a USB drive as your master key (menu option 3). Keep that drive somewhere safe.

## Usage

Run `secure-vault.bat` (or the Start Menu shortcut) for the interactive menu, or use the CLI directly:

```
node secure-vault-launcher.js encrypt "C:\path\to\file"
node secure-vault-launcher.js decrypt "C:\path\to\file.vault"
node secure-vault-launcher.js register master E:\
node secure-vault-launcher.js devices
node secure-vault-launcher.js backup list
node secure-vault-launcher.js help
```

## Building from source

Requires [Inno Setup 6](https://jrsoftware.org/isinfo.php) on Windows, or just push a tag and let GitHub Actions build it for you (see `.github/workflows/build.yml`):

```
iscc installer.iss
```

Output goes to `dist/SecureVaultSetup-<version>.exe`.

## Security notes

- Your encryption key never leaves your USB drive in plaintext form except in memory during encrypt/decrypt operations.
- This project has not undergone an independent third-party security audit. It is built on standard, well-reviewed primitives (Node's built-in `crypto` module, AES-256-GCM, scrypt) but the implementation itself has only been reviewed informally.
- Use at your own risk for anything you cannot afford to lose access to.

## License

MIT — see [LICENSE](LICENSE).
