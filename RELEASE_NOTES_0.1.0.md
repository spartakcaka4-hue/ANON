# ANON Alpha 0.1.0 release notes

Release date: 2026-08-22

## Features

- Windows desktop shell with Home, Search, History, Following, and Settings.
- Official YouTube Data API v3 video and channel search.
- Native channel pages with metadata and paginated uploads.
- Official privacy-enhanced YouTube IFrame playback.
- Local SQLite history, playback progress, follows, settings, and cache.
- Bring-your-own API key configuration in Settings.

## Release hardening

- API keys are no longer eligible for compile-time embedding.
- Saved keys use Windows DPAPI and are not readable by the renderer.
- Database open/migration failures preserve the original file and fall back to a temporary session instead of crashing.
- A top-level React recovery screen handles unexpected render failures.
- Browser fallback storage rejects malformed persisted shapes.
- Production frontend sourcemaps are disabled.
- Tauri capabilities are reduced to the app's registered command surface, with no plugin permissions.
- Packaging is a current-user NSIS installer with WebView2 bootstrap support.
- Product metadata, Alpha version labels, privacy disclosure, network inventory, and release instructions were aligned.

## Known limitations

- The installer is not code-signed and can trigger Windows SmartScreen/unknown-publisher warnings.
- Users must provide their own YouTube Data API key.
- Local follows do not sync with YouTube subscriptions.
- Comments, playlists, downloads, login, subscription sync, and cloud sync are not included.
- YouTube controls playback availability, ads, quality options, and embedded-player behavior.
- A desktop API key cannot be protected like a server secret; restrict, monitor, and rotate it.
- Metadata retained in long-lived History needs additional policy-aware refresh/expiry work before a broad public release.
- Clean-profile installation, full accessibility/DPI coverage, real network capture, and live-player compatibility remain manual certification gates.
