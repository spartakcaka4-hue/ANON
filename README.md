# ANON Alpha 0.1.0

ANON is a privacy-focused Windows desktop client for browsing YouTube without an ANON account, backend, analytics, telemetry, or crash reporting. Search and metadata use the official YouTube Data API v3. Playback uses YouTube's official privacy-enhanced embedded player.

## Project status

ANON is currently an early Windows alpha (0.1.0). The core search, channel browsing, local history/follows, settings, BYOK flow, and official-player paths are implemented and tested. The installer is usable for controlled testing, but it is unsigned and live YouTube/WebView2 compatibility, accessibility, network-capture, and clean-profile certification are still release gates.

This is an alpha, not an anonymity claim. Google/YouTube receives the requests required to search, load images, and play videos, including network information and the YouTube API key used for Data API requests.

## Included in this alpha

- Home, video/channel search, channel pages, uploads, History, Following, and Settings.
- Official YouTube playback with native controls and keyboard shortcuts.
- Local SQLite history, progress, follows, settings, and short-lived search cache.
- Bring-your-own YouTube Data API key; no shared key is bundled.
- In-app key storage protected for the current Windows account with DPAPI.
- Current-user NSIS installer; no administrator privileges are requested.

## Requirements

- Windows 10 or 11 with WebView2.
- For development: Node.js 22+, npm, Rust stable with the MSVC target, and Visual Studio C++ Build Tools.
- A YouTube Data API v3 key for search and metadata.

## Configure a YouTube API key

For an installed build, open **Settings > YouTube API key**, paste your own key, and select **Save key**. ANON encrypts the key with Windows DPAPI for the current Windows account and stores the protected blob separately from the SQLite database. The renderer can check whether a key exists but cannot read it back.

Apply a Google API restriction allowing only **YouTube Data API v3**. Desktop API keys cannot be strongly restricted to one installed application, so monitor the key and revoke or rotate it if it is exposed.

Developers may instead supply the key only to the process that launches Tauri:

```powershell
$env:YOUTUBE_API_KEY = 'your-key'
npm run tauri:dev
```

The runtime environment value is not compiled into the executable. `.env.example` contains placeholders only; never commit a populated `.env`.

## Develop and verify

```powershell
npm ci
npm run dev
npm run check

cd src-tauri
cargo fmt --all -- --check
cargo clippy --all-targets -- -D warnings
cargo test
cd ..
```

Browser development uses a versioned `localStorage` adapter. Native API-key, SQLite, DPAPI, and packaged WebView2 behavior require the Tauri build.

## Build the Windows installer

```powershell
npm ci
npm run check
npm run release:windows
```

The expected artifact is under:

```text
src-tauri\target\release\bundle\nsis\
```

When this project is published, versioned installers will be attached to the GitHub Releases page for the corresponding tag. Until then, build artifacts are local outputs and should be verified before sharing.

The alpha installer is not code-signed. Windows SmartScreen may show an “unknown publisher” warning. Verify the artifact came from the project's trusted release channel before continuing. The installer is per-user and should not require elevation. WebView2 may be downloaded from Microsoft when it is missing.

## Local data

Tauri resolves ANON's application-data directory for identifier `app.anon.desktop`; it is normally equivalent to:

```text
%APPDATA%\app.anon.desktop\anon.db
%APPDATA%\app.anon.desktop\youtube-api-key.bin
```

`anon.db` is an unencrypted SQLite database. `youtube-api-key.bin` is a DPAPI-protected blob usable only in the same Windows user context. Clearing ANON records does not remove the protected API key, WebView2 cookies/cache, Windows backups, or forensic copies. Remove the key separately in Settings.

If the database cannot be opened or migrated, ANON preserves the original file and starts with an in-memory database for that session while showing a recovery notice. It never silently overwrites the damaged database.

## Keyboard shortcuts

On a watch page, while focus is outside a form control:

- `Space`: play or pause
- `Left` / `Right`: seek 5 seconds
- `Up` / `Down`: change volume by 5%
- `F`: fullscreen

YouTube retains its controls, captions, ads, and quality selection.

## Privacy and security

- The webview receives no shell, filesystem, clipboard, arbitrary network, or arbitrary SQL capability.
- Remote strings render as text, and IDs, lengths, settings, and image hosts are validated at trust boundaries.
- The content-security policy allowlists only the official YouTube origins required by the current design.
- ANON has no update checker in Alpha 0.1.0; install newer builds manually from a trusted source.

See [Privacy](docs/PRIVACY.md), [Network behavior](docs/NETWORK.md), [Architecture](ARCHITECTURE.md), and [Security review](docs/SECURITY_REVIEW.md).

## Alpha limitations

- A user-supplied key is required for search and metadata.
- Local follows are not YouTube subscriptions and do not sync.
- Comments, playlists, downloads, login, subscription sync, and cloud sync are not included.
- YouTube may show ads and can change embedded-player behavior.
- Long-lived metadata copied into History still needs policy-aware refresh/expiry work before a broad public release.
- The installer is unsigned, and complete clean-profile, accessibility, network-capture, and real-player certification remain manual release gates.

See [Release notes](RELEASE_NOTES_0.1.0.md) for the exact Alpha 0.1.0 scope.
