# ANON Alpha 0.1.0 QA and release record

Updated: 2026-08-22
Platform exercised: Windows, x64, Tauri 2 release profile.

## Automated release gates

Run from a clean dependency install when preparing another artifact:

```powershell
npm ci
npm run check

cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test
cargo check --release
cd ..

npm audit --audit-level=high
npm audit --omit=dev --audit-level=high
npm run release:windows
```

Also scan source and final artifacts for real credentials without printing matching values. Confirm `.env` remains ignored, `.env.example` contains placeholders only, production sourcemaps are absent, and no compile-time environment macro embeds a key.

## Execution record — 2026-08-22

| Check | Result | Evidence |
| --- | --- | --- |
| ESLint | Pass | Zero-warning policy passed. |
| Frontend tests | Pass | 3 files, 10 tests; includes channel routing, browser persistence, and malformed-storage recovery. |
| TypeScript/Vite production build | Pass | 1,652 modules; production bundle generated with no `.map` files. |
| Rust formatting | Pass | `cargo fmt --all -- --check`. |
| Rust Clippy | Pass | All targets with warnings denied. |
| Rust tests | Pass | 9 tests, including DPAPI round-trip, corrupt-database preservation/fallback, migrations, on-disk pragmas, and exact Referer-hook scope. |
| Rust release check | Pass | Optimized release check completed. Initial cfg-only unused-variable warnings were fixed and rechecked through the release build. |
| npm advisory audit | Pass | Zero vulnerabilities with all dependencies and with production dependencies only. |
| Rust advisory audit | Not run | `cargo-audit` is not installed in this environment. Dependency-tree duplicates were reviewed; that is not a substitute for an advisory scan. |
| Source secret hygiene | Pass (workspace only) | No compile-time environment macro, only fake test keys matched the credential pattern, root `.env` ignore rule present. |
| Git history secret audit | Unavailable | The supplied workspace contains no `.git` metadata. Existing history/commit state cannot be verified here. |
| Artifact secret scan | Pass | The active local `.env` key was not found in the release executable or NSIS installer. The key value was not printed. |
| Production preview | Pass (limited) | 1280×720; Home and Settings rendered, no horizontal overflow, Settings persistence survived reload, Enter submitted search, and browser mode showed the explicit native-required recovery state. |
| Installed app launch | Pass | Installed `anon.exe` remained responsive with title `ANON Alpha 0.1.0`; native Home and Settings rendered through WebView2. |
| Native SQLite/IPC smoke | Pass (read-only) | Existing local counts/history/follows rendered and Settings loaded API-key status, demonstrating registered commands work with the release capability configuration. Existing user data was not cleared or changed. |
| Missing-key state | Pass | Installed Settings reported no configured key and exposed the in-app BYOK control without displaying plaintext key material. |
| NSIS install | Pass | Silent current-user install exited 0; version 0.1.0 registered in HKCU, executable/uninstaller exist, and Start menu shortcut was created. |
| Replace/uninstall cycle | Pass (current account) | The earlier smoke build uninstalled with exit 0, the final artifact reinstalled with exit 0, and the existing `%APPDATA%\app.anon.desktop` user-data directory was preserved. This is not a clean-profile certification. |
| Code signature | Expected limitation | Executable and installer report `NotSigned`. |

## Produced artifacts

```text
src-tauri\target\release\anon.exe
src-tauri\target\release\bundle\nsis\ANON_0.1.0_x64-setup.exe
```

NSIS installer:

- Size: 3,661,921 bytes
- SHA-256: `90A551801806A107EBF88BBA4BF1BE263FF6EA74F27BC5836EE9104CBCA3555E`
- Signature: unsigned

Standalone release executable before bundle patching:

- Size: 13,242,368 bytes
- SHA-256: `5C9F598A9225E9340F41D2DAB226A580A25F36889FD956D89F535BF312BF5088`
- Signature: unsigned

The executable extracted/installed by NSIS includes bundle metadata and therefore has a different hash from the standalone pre-bundle executable.

## Required manual certification before broad distribution

1. Use a dedicated clean Windows profile. Install, launch from Start, exercise the uninstaller, and document whether app data is retained.
2. Save and remove a dedicated restricted test key in Settings. Restart between steps; confirm the key is never displayed or logged.
3. Exercise real video/channel search, pagination, channel pages, and quota/offline/invalid-key recovery.
4. Play several real videos in the installed build and verify the WebView2 Referer/error-153 path, controls, fullscreen, captions, ads, and unavailable-video behavior.
5. Capture idle, search, image, and playback traffic. Reconcile every remote host with `NETWORK.md` and investigate any other party.
6. Complete keyboard-only, screen-reader, focus-dialog, Windows High Contrast, reduced-motion, 125%/150% text scaling, zoom, and DPI checks.
7. Exercise the full window matrix: 1920×1080, 1440×900, 1280×720, 1024×700, 960×720, and minimum-size continuous resizing.
8. Run an independent Rust advisory/license audit and review the exact locked dependency versions.
9. Code-sign the executable and installer before calling the release polished or broadly trusted.

## Release decision

The project now produces a reproducible, installable Alpha 0.1.0 artifact with automated hardening gates and a successful current-user install/native-launch smoke test. It is suitable for controlled alpha handoff with the unsigned/uncertified limitations stated in the README and release notes. Broad public distribution remains gated on the manual items above.
