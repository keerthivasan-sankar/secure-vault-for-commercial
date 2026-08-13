# Security Policy

## Reporting a Vulnerability

If you find a security issue in Secure Vault, please report it privately rather than opening a public GitHub issue — this gives time to investigate and fix before details are public.

**Preferred method:** Open a [GitHub Security Advisory](https://github.com/keerthivasan-sankar/secure-vault-for-commercial/security/advisories/new) (Security tab → Report a vulnerability). This is private between you and the maintainer by default.

**Alternative:** Email [kkeerthivasan811@gmail.com] with a description of the issue, steps to reproduce, and any relevant code/config. Please don't include real credentials or personal data in the report — a redacted example is fine.

## What to expect

- Acknowledgement within a reasonable timeframe (this is a solo/student-maintained project, so response time may vary — please be patient).
- I'll investigate, confirm, and work on a fix.
- Once resolved, the fix will be released and, where appropriate, credited to the reporter (unless you'd prefer to stay anonymous).

## Scope

This covers the Secure Vault application code, the installer build process (`installer.iss`, GitHub Actions workflows), and configuration handling (`config/settings.json`, `config/registered-devices.json`).

Out of scope: issues in third-party dependencies themselves (please report those upstream) — though if you find one affecting Secure Vault specifically (e.g. a vulnerable version we're pinned to), that's still worth flagging here.

## Current automated security measures

- **GitHub CodeQL** — static analysis on every push (JavaScript/TypeScript + Actions workflows)
- **Dependabot** — dependency vulnerability alerts and automated patch PRs
- No independent third-party audit has been performed yet — see [README Security Notes](README.md#security-notes) for full detail on what has and hasn't been reviewed.

Thank you for helping keep Secure Vault and its users safe.
