# Changelog

## v3.3.0 — Security fixes (breaking change)

Thanks to detailed community code review, four real issues were found and fixed. **This is a breaking change** — see the migration note below before updating.

### Fixed

1. **USB key was stored in plaintext.** The 32-byte key on the USB drive is now encrypted at rest (AES-256-GCM, key derived from your password via scrypt). Physical access to the USB drive alone no longer reveals a usable key.
2. **Checksum provided no real tamper protection.** Replaced the unkeyed SHA-256 checksum (which anyone could forge) with a keyed HMAC-SHA256, verified before decryption is attempted.
3. **Command injection via unsanitized filenames.** 7-Zip and `regedit` were invoked via `execSync` with the file path interpolated into a shell string — a crafted filename could break out of quoting and execute arbitrary commands. Switched to `execFileSync` with arguments passed as an array (no shell parsing).
4. **No memory hygiene for key material.** Passwords are now captured as `Buffer`s (not JS strings) and explicitly zeroed after use; the same applies to raw keys and intermediate derived keys throughout the encrypt/decrypt/register flow. This reduces, but does not eliminate, the time sensitive material spends in memory — see the Security notes section of the README for the honest caveat.

### Breaking change — you must re-register your USB key(s)

The key file format on the USB drive has changed (`.vault_master.key` / `.vault_device.key` are now an encrypted blob, not raw bytes). Old key files are **not compatible** with this version.

**Before updating:**
1. If you have any `.vault` files encrypted with the previous version, decrypt them first using the previous version of the software.
2. Update to this version.
3. Re-register your USB drive(s) (menu option 3 / `register.js`) — this will prompt you for a new password and generate a new wrapped key file.
4. Re-encrypt anything you decrypted in step 1.

Files encrypted under the old version cannot be decrypted by this version, and vice versa, because the underlying key material is different.

---

## v3.2.0

Initial public release: AES-256-GCM encryption, USB master/device key registration, encrypted local backups, checksums, secure delete, optional email alerts, right-click integration, one-click Windows installer via Inno Setup + GitHub Actions.
