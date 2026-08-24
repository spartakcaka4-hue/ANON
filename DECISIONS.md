# Engineering decisions

1. **Official YouTube APIs for v1.** Stability and a clear compliance posture outweigh ad-free playback or avoiding quota. Unofficial extraction is not shipped.
2. **Privacy-enhanced official embed.** `youtube-nocookie.com` reduces storage before playback while retaining the supported player controls; it is not described as hiding playback from Google.
3. **Narrow Rust persistence commands.** The frontend gets task-specific commands instead of a generic SQL bridge, reducing the native attack surface.
4. **No bundled shared API key.** Local development uses `.env`; distributors decide how to provision and restrict their own build key.
5. **No fake recommendation feed.** An empty home is useful through search prompts, recent local activity, and honest setup guidance. It never presents fabricated videos as real results.
6. **Browser fallback is non-production.** It makes UI development and automated tests practical; Tauri builds always initialize SQLite.
7. **History is updated on first playback.** Merely opening an unavailable or embedding-disabled video is not counted as a watch. Progress updates begin only after the history write succeeds.
8. **Stable desktop player identity.** A Windows-only WebView2 hook adds ANON's package identity as the Referer on exact, validated `youtube-nocookie.com/embed/<id>` document requests. It cannot rewrite arbitrary traffic.
