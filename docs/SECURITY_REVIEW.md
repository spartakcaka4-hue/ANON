# ANON Alpha 0.1.0 security and privacy review

Review date: 2026-08-22
Target: Tauri 2 on Windows, React/Vite, Rust commands, SQLite, YouTube Data API v3, and the official YouTube embedded player.

## Release posture

The Alpha 0.1.0 source received a static review and automated frontend/native checks. ANON has a deliberately narrow desktop boundary: no shell, filesystem, clipboard, opener, generic HTTP, arbitrary SQL, telemetry, analytics, crash uploader, backend, or updater is exposed or configured.

This is not a claim of anonymity, encrypted history, or completed public-release certification. Google/YouTube necessarily receives feature requests, and final clean-profile installer/player/network/accessibility checks remain manual gates.

## Controls verified in source

- No shared or compile-time API key is bundled. Runtime environment injection is development-only; user-saved keys are protected with Windows DPAPI.
- The renderer receives only key status and cannot retrieve plaintext key material.
- YouTube API requests are Rust-owned, use HTTPS, send the key in `x-goog-api-key`, and expose normalized user errors.
- Tauri capability permissions are empty; only the registered ANON commands form the IPC surface.
- Rust validates command input and remote identifiers, uses parameterized SQL, and bounds lists/strings/settings.
- Remote strings render as text. Remote image URLs require HTTPS and allowlisted YouTube-owned hosts.
- The CSP blocks arbitrary remote scripts, frames, connections, objects, forms, and base changes.
- Production frontend sourcemaps are disabled and the release Windows subsystem has no console window.
- Database open/migration failure preserves the original file, falls back to a migrated in-memory database, and presents a startup notice.
- The top-level React error boundary provides a reload path without uploading diagnostics.
- Production code contains no intentional logging of keys, queries, watch history, remote payloads, or stack traces.
- The NSIS configuration installs for the current user and does not request administrator privileges.

## Findings and residual risks

| Severity | Finding | Release handling |
| --- | --- | --- |
| High | A standard Google desktop API key cannot be restricted to one installed binary like a server secret. | Require BYOK, restrict the key to YouTube Data API v3, never return it to the renderer, and document monitoring/revocation. |
| High | Packaged WebView2 playback can be affected by YouTube's runtime policy, including player error 153. | Keep the exact-scope Referer hook and run a live packaged player smoke test before distributing broadly. |
| Medium | SQLite history/settings are not encrypted. DPAPI protects only the saved API key. | State this plainly; do not claim protection from administrators, malware, backups, or forensics. |
| Medium | The official player is third-party remote content and may contact additional Google delivery/advertising endpoints. | Use the official privacy-enhanced embed, constrain the main application CSP/IPC surface, document parties, and perform release traffic capture. |
| Medium | The unsigned installer can be replaced in transit or trigger SmartScreen. | Distribute through a trusted channel with hashes; code signing is required for a polished public release. |
| Medium | Long-lived metadata in History still needs policy-aware refresh/expiry. | Treat as a prerequisite for broad distribution, not as complete in this alpha. |
| Low | SQLite/DPAPI recovery notices are generic and do not provide an in-app file export/reset workflow. | Preserve originals; add an explicit, user-confirmed recovery tool in a later release. |

## Threat model

The design primarily limits:

1. Malicious or malformed remote metadata reaching the renderer.
2. A renderer compromise escalating to shell, filesystem, arbitrary network, or SQL access.
3. Accidental key disclosure through JavaScript, compile-time embedding, logs, or SQLite.
4. SQL injection, unsafe migrations, and silent database replacement after corruption.
5. Misleading “local-only” language that hides Google/YouTube traffic or overstates deletion.

Out of scope: defending local records from an administrator, malware or another same-user process; Windows/storage forensics and backups; compromise of Google/YouTube; and strong identity of an unsigned installer.

## Release verification record

Update [QA_PLAN.md](QA_PLAN.md) with each concrete command, artifact hash, installer smoke result, and remaining manual gate. Do not promote an unchecked item to a pass.

Required remaining manual evidence before broad release:

- Install/uninstall from a clean Windows user profile and confirm Start menu/uninstall behavior.
- Launch the installed build, save/remove a dedicated test key, and confirm restart persistence without revealing it.
- Exercise live search, channel navigation, playback, History, Following, offline/retry, and clear-data flows.
- Capture network traffic and reconcile every host with [NETWORK.md](NETWORK.md).
- Complete keyboard, screen-reader, High Contrast, DPI/text-scaling, and minimum-window checks.
- Code-sign the executable and installer for a polished public release.
