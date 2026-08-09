# Changelog

## v3.4.0 — Hardening pass (breaking change)

Following a focused security review of `crypto.js` and `auth.js`.

### Changed

1. **Scrypt cost parameter doubled** (`N`: 2^15 → 2^16, 32MB → 64MB memory cost). This raises the bar against offline brute-force of a stolen `.vault_master.key` or `.vault_device.key` file, particularly given the password minimum is only 8 characters with no complexity requirement. Chosen based on actual timing tests to stay under ~450ms total per operation — strong enough to matter, not slow enough to tempt anyone toward weaker passwords out of impatience.
2. **Explicit length validation added** to `decryptWithPerFileKey()` in `crypto.js`. Previously, a truncated or corrupted `.vault` file could produce a low-level, unfriendly error from Node's crypto bindings instead of a clean, expected message. This is defense-in-depth — the error was already caught and shown cleanly by `decrypt.js`'s existing try/catch, but the function now validates its own input correctly regardless of caller.

### Breaking change — you must re-register your USB key(s) again

Scrypt parameters aren't stored in the key file itself, so a key wrapped under the old cost (v3.3.0/v3.3.1) cannot be unwrapped correctly under this version's higher cost — the derived wrapping key will differ.

**Before updating, same process as the v3.3.0 migration:**
1. Decrypt any `.vault` files you need using the previous version.
2. Update to this version.
3. Re-register your USB drive(s) (menu option 3 / `register.js`).
4. Re-encrypt anything you decrypted in step 1.

This is the second breaking change to the key format in quick succession — genuinely sorry for the churn if you're actively using this. The parameter chosen here is meant to hold for the foreseeable future rather than need another bump soon.

---

## v3.3.1

Dependency fix: `nodemailer` pinned to exact version `9.0.5`, resolving 8 Dependabot security alerts (SMTP injection, CRLF injection, SSRF, DoS, TLS validation bypass, and related issues in older nodemailer versions).

---

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
