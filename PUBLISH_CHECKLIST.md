# Publishing Checklist

Concrete steps to go from "zip on my machine" to "installer people can download and trust."

## 1. Put it on GitHub (free, do this first)

- Create a public repo, e.g. `github.com/yourname/secure-vault`.
- Push everything in this folder, including `.github/workflows/build.yml`.
- Add a real `icon.ico` (referenced by `installer.iss`) — any 256x256 icon converted to `.ico` works. Without it, remove the `SetupIconFile`/`icon.ico` lines from `installer.iss` and it'll use Inno Setup's default icon instead.
- Add a `LICENSE` file (MIT is a reasonable default for a tool like this — GitHub can generate one for you when creating the repo).

## 2. Let GitHub Actions build the installer for you

You don't need a Windows machine. Once the workflow file is pushed:
- Every push to `main` builds and syntax-checks the installer as a sanity check.
- Every tag matching `v*` (e.g. `v3.2.0`) triggers a build **and** automatically attaches the resulting `.exe` to a GitHub Release.

To cut a release:
```
git tag v3.2.0
git push origin v3.2.0
```
Then create a Release on GitHub pointing at that tag — the workflow attaches the `.exe` automatically.

## 3. Code signing (the SmartScreen problem)

Without this, Windows will show "Windows protected your PC" / "Unknown publisher" warnings — because you're distributing an installer that itself installs software and modifies the registry (right-click menu), which is exactly the profile SmartScreen flags hardest.

Options, cheapest to most robust:
- **Do nothing initially.** Many small open-source tools ship unsigned; users click "More info" → "Run anyway." Fine for a niche/technical audience, bad for general public trust.
- **Buy an OV (Organization Validation) code signing certificate** (~$70-250/year from providers like SSL.com, Sectigo, or DigiCert). This removes the "Unknown Publisher" label but SmartScreen reputation still needs to build up over time/downloads before the warning disappears entirely.
- **EV (Extended Validation) certificate** (~$300+/year, requires more identity verification, often hardware-token-based). Gets **instant** SmartScreen reputation — no warning from day one. Worth it only if you expect meaningful download volume.

For a personal/niche tool, OV is the reasonable middle ground if you decide to sign at all.

## 4. Wider distribution (optional, once stable)

- **Winget**: submit a manifest to [microsoft/winget-pkgs](https://github.com/microsoft/winget-pkgs) so people can `winget install SecureVault`. Free, just a PR process.
- **Chocolatey**: similar process, `choco install securevault`.
- Both require your installer to support **silent install flags** (Inno Setup supports `/VERYSILENT` out of the box, so you're already compatible).

## 5. Before any of this — one more security pass worth doing

Since this will now be used by people other than you:
- Consider having someone else (or a paid freelance security reviewer) look at `crypto.js` and `auth.js` specifically — the parts that matter most if something's subtly wrong.
- Add a note in the README (already done) that this hasn't had a formal audit, so users can make an informed choice.
- Decide what happens if `nodemailer`/npm has a supply-chain issue — pin exact dependency versions in `package.json` rather than using loose ranges.

## Summary of what's already done for you in this package

- [x] Inno Setup script (`installer.iss`) — replaces the raw `.bat` installer with a real Windows installer (proper uninstaller, Start Menu group, admin elevation prompt, optional right-click integration as a checkbox instead of always-on)
- [x] GitHub Actions workflow — builds the installer automatically, no local Windows machine needed
- [x] README.md — public-facing docs, now with your logo
- [x] icon.ico — generated from your logo (multi-resolution, 16px-256px)
- [ ] LICENSE — pick one when creating the GitHub repo
- [ ] Code signing certificate — your call based on budget/audience
