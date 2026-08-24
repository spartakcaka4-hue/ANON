# ANON architecture

ANON Alpha 0.1.0 is a Windows-only Tauri 2 application. React owns presentation and navigation. Rust owns privileged persistence, API-key handling, and YouTube Data API access. There is no ANON server.

```text
React views -> YouTubeProvider -> narrow Tauri commands -> YouTube Data API v3
           -> OfficialPlayer                         -> youtube-nocookie.com
           -> LocalRepository -> narrow Tauri commands -> SQLite in app data
                              -> browser localStorage adapter (development only)
```

## Modules

- `src/app`: routing, providers, shell, and application state.
- `src/components`: reusable UI, media, dialogs, and the top-level error boundary.
- `src/pages`: route-level screens; the player route is lazy-loaded.
- `src/services/youtube`: typed provider contract, official provider, mapping, and safe user-facing errors.
- `src/storage`: typed repository plus native and browser adapters.
- `src/domain`: shared models and defaults.
- `src-tauri`: capability policy, DPAPI key storage, HTTP client, SQLite migrations, and narrow commands.

## Native trust boundary

The webview has an empty plugin/core capability list and no shell, filesystem, opener, clipboard, generic HTTP, or SQL plugin. Only commands registered by ANON are callable. Native commands validate input sizes, IDs, URLs, settings, and cached payloads and use parameterized SQL.

Data API traffic originates in Rust. React sends a query or identifier through the typed provider and receives normalized data or a stable user-facing error. Remote strings render as React text. Thumbnail URLs must be HTTPS and use an allowlisted YouTube-owned host.

## API-key strategy

No API key is compiled into or bundled with the application.

- Installed users can save a key through Settings. Rust validates it, encrypts it with Windows DPAPI for the current user, and writes `youtube-api-key.bin` in app data.
- Rust returns only configured/persisted status to React; the plaintext key is never returned to the renderer.
- Developers can set `YOUTUBE_API_KEY` in the launching process. That value is session-only unless the user explicitly saves a key in Settings.
- The key is sent only as the `x-goog-api-key` header on official YouTube Data API requests.

A desktop-distributed key cannot be treated like a server secret. BYOK, API restriction to YouTube Data API v3, and user-controlled revocation are the release posture.

## Persistence and recovery

SQLite is created as `anon.db` under Tauri's resolved application-data directory for `app.anon.desktop`.

- `video_cache`: normalized metadata by video ID.
- `watch_history`: watch time and denormalized display metadata.
- `search_history`: query and last-searched timestamp.
- `followed_channels`: local-only follows.
- `playback_progress`: last position by video.
- `settings`: typed setting values.
- `cached_searches`: query/page-token cache with expiry.

The schema uses `PRAGMA user_version`, WAL, foreign keys, secure delete, a busy timeout, and repeatable migrations. Clearing records is transactional; checkpoint/compaction is best-effort.

If opening or migrating the on-disk database fails, the original file is preserved. ANON opens a migrated in-memory database for the session and surfaces a startup notice instead of crashing or silently resetting user data.

## Player boundary

Playback uses YouTube's official IFrame Player at `youtube-nocookie.com`. ANON does not proxy or re-host media. A narrowly scoped Windows WebView2 hook adds `Referer: https://app.anon.desktop/` only to validated privacy-enhanced embed-document requests. It is not exposed as a generic header-rewrite API.

The official player necessarily contacts Google/YouTube infrastructure and may show ads. Privacy-enhanced embedding changes YouTube behavior; it does not make playback anonymous.

## Content security and performance

The production CSP allows only the YouTube script/frame/image origins required by the app and blocks arbitrary remote scripts, frames, objects, forms, and connections. Frontend production sourcemaps are disabled.

Routes are split, player code loads only on the watch route, images are lazy-loaded, repository initialization runs once, and search cache reads precede network work.
