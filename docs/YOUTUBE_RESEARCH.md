# YouTube integration research (official path)

Research date: 2026-08-22. Sources are current official YouTube, Google Cloud, Tauri, and Microsoft documentation. YouTube changed its quota model in June 2026, so older articles saying that each `search.list` request costs 100 general quota units are now stale.

## Decision

Use the official YouTube Data API v3 for discovery/metadata and the official YouTube IFrame Player API for playback. For every player, prefer the privacy-enhanced `https://www.youtube-nocookie.com/embed/...` host, keep YouTube's controls enabled, do not suppress ads/cookies/context signals, and default autoplay to off.

This is the smallest stable and Terms-compliant v1. It does **not** make playback anonymous to Google. Search requests and embedded playback necessarily disclose network and request context to Google/YouTube; the defensible promise is that ANON adds no account, telemetry, analytics, or server-side collection of its own.

## Data API and quota reality in 2026

- Since 2026-06-01, `search.list` has a separate **Search Queries** bucket. The default is **100 calls/day**, and each call costs **1 unit from that bucket**. It no longer costs 100 units from the general 10,000-unit pool. Each pagination request is another search call. Daily quotas reset at midnight Pacific Time, and invalid requests still consume quota. See the [current `search.list` reference](https://developers.google.com/youtube/v3/docs/search/list), [quota calculator](https://developers.google.com/youtube/v3/determine_quota_cost), and [June 2026 revision note](https://developers.google.com/youtube/v3/revision_history).
- The default general bucket remains 10,000 units/day for other endpoints. One batched `videos.list` call costs 1 unit and can enrich up to 50 IDs with `snippet`, `contentDetails`, `statistics`, and `status`. See [`videos.list`](https://developers.google.com/youtube/v3/docs/videos/list).
- One result page should therefore be exactly: (1) `search.list(part=snippet,type=video,videoEmbeddable=true,videoSyndicated=true,maxResults=25)` and (2) one `videos.list` for those IDs. The second request supplies duration, current statistics, description/status, and Made-for-Kids state. Do not issue one metadata call per card.
- Submit only on Enter/button; a debounce is useful for UI state but must not turn typing into requests. Normalize and cache `(query, filters, locale, pageToken)`. Do not prefetch the next page: 100 user-visible search pages/day is the default ceiling.
- Use `nextPageToken`; YouTube explicitly says the approximate `totalResults` is not suitable for building pagination. On `403` with reason `quotaExceeded`/`dailyLimitExceeded`, show a quota-specific state, retain cached results, and explain the Pacific-Time reset. See [official error semantics](https://developers.google.com/youtube/v3/docs/errors).
- A useful Home need not spend search quota: use `videos.list(chart=mostPopular,regionCode=...)` (1 general unit), cache it, and refresh conservatively. Note that since July 2025 this chart reflects selected Music, Movies, and Gaming charts rather than the former Trending page behavior.
- Cached YouTube API metadata is Non-Authorized API Data. It must be refreshed or deleted within 30 calendar days; current data should replace stale titles/statistics sooner where practical. Local user-authored history/preferences can persist under ANON's disclosed local-data controls, but copied YouTube metadata attached to them should carry `fetched_at` and obey the API-data refresh/delete rule. See the [Developer Policies, III.E.4](https://developers.google.com/youtube/terms/developer-policies).

## API key handling and restrictions

There is no strong way to hide a shared Google API key inside a distributed Windows desktop binary. A `VITE_*` key is directly present in the renderer bundle; moving it to Rust avoids casual exposure to renderer code but does not make an embedded/shared key secret. Google also offers no "Windows desktop app" client restriction for standard API keys: supported restriction types are HTTP referrers, caller IPs, Android apps, and iOS apps. See [Google's restriction types](https://docs.cloud.google.com/api-keys/docs/add-restrictions-api-keys).

Recommended v1:

1. Use bring-your-own-key (BYOK) for distributable builds, or require `YOUTUBE_API_KEY` at runtime for development. Never commit a real key and never bake it through a `VITE_*` variable. A missing key is an explicit first-run configuration state.
2. Send Data API calls through a narrow Rust command/service, validate query length/parameters there, and pass the key in the `x-goog-api-key` header rather than the URL. Google warns that URL query keys leak through URL scanning/logging. See [API-key best practices](https://docs.cloud.google.com/docs/authentication/api-keys-best-practices).
3. Always add an API restriction allowing only **YouTube Data API v3** (`youtube.googleapis.com`). This is useful even when no workable client restriction exists.
4. Do not apply an IP restriction to an end-user desktop app; users' egress IPs are not stable or known. HTTP-referrer restrictions only fit renderer-side requests. In a Windows Tauri production webview they could target `https://tauri.localhost/*` if `use_https_scheme(true)` is enabled, plus the exact Vite dev origin for development. This is defense-in-depth, not app attestation, and it is incompatible with Rust-originated HTTP calls because those calls carry neither the renderer referrer nor a stable user IP.
5. Store a runtime BYOK value with Windows Credential Manager/DPAPI if persistence is added. A plaintext SQLite/settings value conflicts with the project's credential-storage requirement. Provide clear remove/replace controls.

If a shared project key is ever shipped, document that all installations share its 100-search-call bucket and that extraction/abuse can exhaust every user's quota. A backend would solve some restriction and rotation problems, but it contradicts ANON v1's no-server requirement; do not quietly add one.

## IFrame player privacy and behavior

- Privacy-enhanced mode uses `www.youtube-nocookie.com`. YouTube says views in this mode are not used to personalize the viewer's YouTube browsing experience and ads served in the player are non-personalized. It does **not** mean "no cookies," "no Google requests," or "no data collection." The [official embed help](https://support.google.com/youtube/answer/171780) explicitly supports WebView embeds.
- Loading a player already shares basic data with YouTube to render title/thumbnail, determine playability/restrictions, and address fraud/abuse; playback shares additional data. YouTube also forbids interfering with playback-context signals, including cookies. Set `autoplay=0` and mount the iframe only after clear user intent to open/play the video to minimize pre-playback sharing. See [Developer Policies III.E.4.i](https://developers.google.com/youtube/terms/developer-policies) and the [policy compliance guide](https://developers.google.com/youtube/terms/developer-policies-guide).
- Before embedding, retrieve `status.madeForKids` via `videos.list`. YouTube requires every client to check this and apply the required child-directed tracking/data treatment. Using the no-cookie host for all videos is the safest baseline, but the official text does not say that host selection alone discharges COPPA/GDPR duties; treat this as a release compliance checkpoint. See [Finding MadeForKids status](https://developers.google.com/youtube/v3/guides/made_for_kids_status).
- Keep `controls=1`, `enablejsapi=1`, `playsinline=1`, `fs=1`, and `rel=0`; `rel=0` only limits end-screen recommendations to the same channel and no longer disables them. `modestbranding` is deprecated and ineffective. Do not cover or replace required player controls/branding.
- The API supports play/pause, seek, volume, mute, fullscreen integration, state events, and playback-rate suggestions. Programmatic quality selection is **not supported**: `setPlaybackQuality` and related functions are no-ops/removed. Leave YouTube's settings control available and describe default-quality selection as unsupported in v1. See the [IFrame API revision notes](https://developers.google.com/youtube/iframe_api_reference#Revision_History).
- Keep the viewport at least 200x200; YouTube recommends at least 480x270 for a 16:9 player with controls. Handle errors `2`, `5`, `100`, `101`/`150`, and especially `153` (missing Referer/client identification). The player may reject age-restricted, private, deleted, region-restricted, or embedding-disabled videos.

## Tauri/WebView2 origin and Referer: required engineering spike

`origin` and `Referer` serve different purposes and both matter:

- With `enablejsapi=1`, set the player `origin` parameter to the **exact parent document origin** used by `postMessage`: normally `https://tauri.localhost` in a production Windows build when Tauri's `use_https_scheme(true)` is enabled, and the exact `http://localhost:<port>` Vite origin in development. Never hardcode the dev origin into release. YouTube says `origin` should always be supplied for IFrame API control. See [player parameters](https://developers.google.com/youtube/player_parameters#origin) and [Tauri's `use_https_scheme`](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindowBuilder.html#method.use_https_scheme).
- Since July 2025, YouTube requires embedded clients to identify themselves via `HTTP Referer`; missing identity can produce player error `153`. Its current guidance specifically says desktop WebViews often have an empty Referer and should set one through the WebView. The explicit Referer should be HTTPS and use the stable Windows package-identity `Name` (not version/architecture). See [Required Minimum Functionality: API Client Identity](https://developers.google.com/youtube/terms/required-minimum-functionality#api-client-identity-and-credentials).
- Do not assume Tauri's automatic `https://tauri.localhost/` referrer is sufficient: it is a generic webview origin, not the Windows package identity described by YouTube. Conversely, do not set the `origin` parameter to the package ID; that would not match the actual parent origin and can break IFrame API messaging.
- Tauri's high-level `on_web_resource_request` currently modifies only its own URI-protocol responses, not external YouTube requests. On Windows, a compliant fallback can use `WebviewWindow::with_webview` to access CoreWebView2, register a narrowly scoped `WebResourceRequested` filter for YouTube embed **document** requests, and set the `Referer` header to `https://<stable-package-identity-name>`. Pin Tauri's minor version when using the platform handle. See [Tauri platform-webview access](https://docs.rs/tauri/latest/tauri/webview/struct.WebviewWindow.html#method.with_webview) and [Microsoft's request-header interception](https://learn.microsoft.com/en-us/microsoft-edge/webview2/how-to/webresourcerequested).
- Use `Referrer-Policy: strict-origin-when-cross-origin`, YouTube's recommended policy. Do not use `no-referrer`, an iframe `referrerpolicy` that suppresses identity, or `window.open(..., 'noreferrer')`.

ANON now implements the recommended, document-only WebView2 hook with exact host/path/video-ID validation and a stable `https://app.anon.desktop/` Referer. Before calling playback complete, verify a **packaged production build** in WebView2 DevTools/network (not only Vite dev):

1. The parent origin and `origin=` value match exactly.
2. The initial `youtube-nocookie.com/embed/...` document request has the intended stable HTTPS Referer and does not throw error 153.
3. Play/pause, seek, volume, speed, fullscreen, history progress events, and keyboard focus work.
4. Autoplay is off by default; ads, settings, branding, captions, and related-video UI are not obstructed.
5. Embedding-disabled, unavailable, age-restricted, offline, and quota-exhausted cases produce distinct user-facing errors.

## Concrete implementation boundary

Keep one `YouTubeProvider` abstraction, but split its implementation internally into:

- `YouTubeDataClient` (Rust): key/config validation, `search.list`, batched `videos.list`, error normalization, and quota-aware cache timestamps.
- `YouTubePlayerAdapter` (renderer): one privacy-enhanced iframe, exact-origin configuration, API lifecycle/events, progress sampling, and teardown on navigation.

The privacy UI should say, in substance: **ANON stores history, follows, settings, and cached metadata locally. When the user searches or plays, the query/video ID plus network and request/player context are sent directly to Google/YouTube. Privacy-enhanced playback reduces personalization; it does not prevent YouTube from receiving the playback request.**
