# Network behavior

ANON has no first-party backend. Its intended outbound traffic is limited to the services below.

| Service or host | When contacted | Data involved |
| --- | --- | --- |
| `youtube.googleapis.com` | After a user requests search, channel, uploads, or video metadata | User-supplied API key in `x-goog-api-key`, query text, IDs, pagination tokens, and normal network metadata |
| `i.ytimg.com` | When result/history artwork is displayed | Image path/ID, referrer behavior, and normal network metadata |
| `yt3.ggpht.com`, `yt3.googleusercontent.com` | When channel avatars or banners are displayed | Image path/ID and normal network metadata |
| `www.youtube.com` | When the official IFrame Player API script is needed | Player bootstrap request and normal network metadata |
| `www.youtube-nocookie.com` | When a watch page creates or uses the official player | Video ID, player configuration/actions, playback requests, and normal network metadata |
| Google/YouTube delivery and advertising infrastructure selected by the official player | During player bootstrap and playback | Data required by YouTube to serve the player, media, captions, controls, and ads |
| Microsoft WebView2 distribution endpoints | During installation only when WebView2 is missing | Installer/runtime bootstrap request and normal network metadata |

ANON does not intentionally contact an ANON server, analytics provider, telemetry service, crash-reporting service, ad network of its own, or update service.

Search and metadata requests are made by Rust, not by an unrestricted renderer HTTP bridge. No Data API request is made merely by typing; search is submit-only. Images and the official player load when their corresponding interface content is displayed.

This list describes intended application behavior. A release traffic capture remains the final check that dependencies and the WebView2/YouTube runtime behave as documented.
