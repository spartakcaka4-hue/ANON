# Privacy model

ANON Alpha 0.1.0 has no ANON account, backend, telemetry, analytics, crash reporting, advertising system, or automatic update request.

## Stored locally

Depending on settings and use, ANON stores watch history, playback position, search history, local follows, settings, cached metadata, and cached search responses in an unencrypted SQLite database under the Windows application-data directory.

If you save a YouTube API key in Settings, ANON stores it separately as a Windows DPAPI-protected blob. It is bound to the current Windows user context and is never returned to the React renderer. It is not stored in SQLite.

ANON does not claim local data is protected from an administrator, malware, another process running as you, disk forensics, or backups.

## Sent to Google/YouTube

- Your API key and search terms when you submit a search.
- Channel, playlist, and video identifiers needed to load requested pages and metadata.
- Image requests for thumbnails, avatars, and banners displayed in the interface.
- Video identifiers, player configuration, playback actions, and network information required by the official embedded player.
- Other data handled by YouTube's player and advertising systems under Google's policies.

The official player uses YouTube's privacy-enhanced embed domain. This does not make requests invisible or anonymous to Google. ANON does not proxy YouTube traffic or add a second data-collection layer.

## Clearing and removal

“Clear ANON records and cache” removes the categories listed in its confirmation dialog from SQLite and attempts to checkpoint/compact the database. It does not remove:

- the protected API key (use **Remove key** separately),
- WebView2/YouTube cookies and cache,
- Windows backups or restore points,
- copies made outside ANON, or
- storage-layer forensic remnants.

Removing the key deletes ANON's local protected blob but does not revoke the key at Google. Revoke or rotate it in Google Cloud when needed.

## Failure behavior

If the database cannot be opened or migrated, ANON preserves the original file and uses a temporary in-memory database for that session. A notice explains that changes made during the fallback session will not persist. ANON does not upload diagnostics.

See [Network behavior](NETWORK.md) for the complete intended outbound-service inventory.
