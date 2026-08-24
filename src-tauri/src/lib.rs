use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
    sync::{Mutex, RwLock},
    time::{Duration, SystemTime, UNIX_EPOCH},
};
use tauri::{Manager, State};

struct DbState(Mutex<Connection>, Option<String>);

struct YouTubeState {
    client: reqwest::Client,
    api_key: RwLock<Option<String>>,
}

struct ApiKeyStorageState(PathBuf);

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct VideoRecord {
    id: String,
    title: String,
    channel_id: String,
    channel: String,
    thumbnail: String,
    published_at: Option<String>,
    duration_seconds: Option<i64>,
    view_count: Option<i64>,
    description: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct HistoryRecord {
    #[serde(flatten)]
    video: VideoRecord,
    watched_at: i64,
    position_seconds: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ChannelRecord {
    id: String,
    name: String,
    avatar: Option<String>,
    followed_at: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct Bootstrap {
    settings: HashMap<String, Value>,
    history: Vec<HistoryRecord>,
    follows: Vec<ChannelRecord>,
    startup_notice: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct ApiKeyStatus {
    configured: bool,
    persisted: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct PrivacyStats {
    history_count: i64,
    follow_count: i64,
    approximate_bytes: u64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProgressInput {
    video_id: String,
    position_seconds: i64,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SettingInput {
    key: String,
    value: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SearchInput {
    query: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct CacheInput {
    cache_key: String,
    payload: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ApiKeyInput {
    api_key: String,
}

fn normalize_api_key(value: &str) -> Result<String, String> {
    let normalized = value.trim();
    if !(20..=200).contains(&normalized.len())
        || !normalized.is_ascii()
        || normalized.bytes().any(|byte| byte.is_ascii_whitespace())
    {
        return Err("Enter a valid YouTube Data API key without spaces".into());
    }
    Ok(normalized.to_owned())
}

#[cfg(windows)]
fn protect_secret(value: &str) -> Result<Vec<u8>, String> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{CryptProtectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB},
    };

    let bytes = value.as_bytes();
    let input = CRYPT_INTEGER_BLOB {
        cbData: bytes.len() as u32,
        pbData: bytes.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let protected = unsafe {
        CryptProtectData(
            &input,
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if protected == 0 || output.pbData.is_null() {
        return Err("Windows could not protect the API key".into());
    }
    let result =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()) };
    Ok(result)
}

#[cfg(windows)]
fn unprotect_secret(value: &[u8]) -> Result<String, String> {
    use windows_sys::Win32::{
        Foundation::LocalFree,
        Security::Cryptography::{
            CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
        },
    };

    if value.is_empty() || value.len() > 16_384 {
        return Err("The protected API-key file was invalid".into());
    }
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();
    let unprotected = unsafe {
        CryptUnprotectData(
            &input,
            std::ptr::null_mut(),
            std::ptr::null(),
            std::ptr::null(),
            std::ptr::null(),
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
    };
    if unprotected == 0 || output.pbData.is_null() {
        return Err("Windows could not read the protected API key".into());
    }
    let bytes =
        unsafe { std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec() };
    unsafe { LocalFree(output.pbData.cast()) };
    String::from_utf8(bytes).map_err(|_| "The protected API key was invalid".into())
}

#[cfg(not(windows))]
fn protect_secret(_value: &str) -> Result<Vec<u8>, String> {
    Err("Protected API-key storage is supported on Windows only".into())
}

#[cfg(not(windows))]
fn unprotect_secret(_value: &[u8]) -> Result<String, String> {
    Err("Protected API-key storage is supported on Windows only".into())
}

fn load_protected_api_key(path: &Path) -> Result<Option<String>, String> {
    match fs::read(path) {
        Ok(bytes) => unprotect_secret(&bytes)
            .and_then(|value| normalize_api_key(&value))
            .map(Some),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("ANON could not read its protected API-key file".into()),
    }
}

fn valid_video_id(value: &str) -> bool {
    value.len() == 11
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

#[cfg(windows)]
fn is_youtube_embed_document(raw: &str) -> bool {
    let Ok(url) = tauri::Url::parse(raw) else {
        return false;
    };
    let Some(id) = url.path().strip_prefix("/embed/") else {
        return false;
    };
    url.scheme() == "https"
        && url.host_str() == Some("www.youtube-nocookie.com")
        && url.port().is_none()
        && url.username().is_empty()
        && url.password().is_none()
        && valid_video_id(id)
}

#[cfg(windows)]
fn install_youtube_referer(window: &tauri::WebviewWindow) -> tauri::Result<()> {
    use webview2_com::{
        take_pwstr, CoTaskMemPWSTR,
        Microsoft::Web::WebView2::Win32::COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT,
        WebResourceRequestedEventHandler,
    };

    const FILTER: &str = "https://www.youtube-nocookie.com/embed/*";
    const REFERER: &str = "https://app.anon.desktop/";

    window.with_webview(|platform| {
        let controller = platform.controller();
        let webview = match unsafe { controller.CoreWebView2() } {
            Ok(value) => value,
            Err(_error) => {
                #[cfg(debug_assertions)]
                eprintln!("CoreWebView2 unavailable: {_error}");
                return;
            }
        };
        let filter = CoTaskMemPWSTR::from(FILTER);
        if let Err(_error) = unsafe {
            webview.AddWebResourceRequestedFilter(
                *filter.as_ref().as_pcwstr(),
                COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT,
            )
        } {
            #[cfg(debug_assertions)]
            eprintln!("YouTube request filter install failed: {_error}");
            return;
        }

        let handler = WebResourceRequestedEventHandler::create(Box::new(move |_sender, args| {
            let Some(args) = args else {
                return Ok(());
            };
            let mut context = Default::default();
            unsafe { args.ResourceContext(&mut context)? };
            if context != COREWEBVIEW2_WEB_RESOURCE_CONTEXT_DOCUMENT {
                return Ok(());
            }

            let request = unsafe { args.Request()? };
            let mut raw_uri = Default::default();
            unsafe { request.Uri(&mut raw_uri)? };
            let uri = take_pwstr(raw_uri);
            if !is_youtube_embed_document(&uri) {
                return Ok(());
            }

            let name = CoTaskMemPWSTR::from("Referer");
            let value = CoTaskMemPWSTR::from(REFERER);
            unsafe {
                request
                    .Headers()?
                    .SetHeader(*name.as_ref().as_pcwstr(), *value.as_ref().as_pcwstr())?
            };
            Ok(())
        }));
        let mut token = 0;
        if let Err(_error) = unsafe { webview.add_WebResourceRequested(&handler, &mut token) } {
            #[cfg(debug_assertions)]
            eprintln!("YouTube request handler install failed: {_error}");
        }
    })
}

fn valid_channel_id(value: &str) -> bool {
    (3..=64).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn valid_playlist_id(value: &str) -> bool {
    (3..=128).contains(&value.len())
        && value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || byte == b'_' || byte == b'-')
}

fn validate_page_token(page_token: &Option<String>) -> Result<(), String> {
    if page_token
        .as_ref()
        .is_some_and(|token| token.len() > 256 || !token.is_ascii())
    {
        return Err("Invalid YouTube page token".into());
    }
    Ok(())
}

fn ordered_resource_items(ids: &[String], response: &Value) -> Vec<Value> {
    let by_id: HashMap<&str, &Value> = response
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.get("id").and_then(Value::as_str).map(|id| (id, item)))
        .collect();
    ids.iter()
        .filter_map(|id| by_id.get(id.as_str()).map(|item| (*item).clone()))
        .collect()
}

fn validate_video(video: &VideoRecord) -> Result<(), String> {
    if !valid_video_id(&video.id) || !valid_channel_id(&video.channel_id) {
        return Err("Remote video identifiers were invalid".into());
    }
    if video.title.is_empty()
        || video.channel.is_empty()
        || video.title.chars().count() > 500
        || video.channel.chars().count() > 200
    {
        return Err("Remote video metadata exceeded safe limits".into());
    }
    if video.thumbnail.len() > 1000 || !video.thumbnail.starts_with("https://i.ytimg.com/") {
        return Err("Remote thumbnail address was not allowed".into());
    }
    if video
        .description
        .as_ref()
        .is_some_and(|value| value.chars().count() > 100_000)
    {
        return Err("Remote description exceeded safe limits".into());
    }
    if video
        .duration_seconds
        .is_some_and(|value| !(0..=604_800).contains(&value))
        || video.view_count.is_some_and(|value| value < 0)
    {
        return Err("Remote video numbers exceeded safe limits".into());
    }
    Ok(())
}

async fn google_json(
    state: &YouTubeState,
    endpoint: &str,
    query: &[(&str, String)],
) -> Result<Value, String> {
    let key = state
        .api_key
        .read()
        .map_err(|_| "API key storage is temporarily unavailable".to_string())?
        .clone()
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| {
            "API key configuration is missing. Add your key in Settings → YouTube access."
                .to_string()
        })?;
    let response = state
        .client
        .get(format!(
            "https://youtube.googleapis.com/youtube/v3/{endpoint}"
        ))
        .header("x-goog-api-key", &key)
        .query(query)
        .send()
        .await
        .map_err(|error| format!("Network request failed: {error}"))?;
    let status = response.status();
    let body: Value = response
        .json()
        .await
        .map_err(|error| format!("Malformed YouTube response: {error}"))?;
    if !status.is_success() {
        let reason = body
            .pointer("/error/errors/0/reason")
            .and_then(Value::as_str)
            .unwrap_or("requestFailed");
        let message = body
            .pointer("/error/message")
            .and_then(Value::as_str)
            .unwrap_or("YouTube request failed");
        return Err(format!("YouTube {reason}: {message}"));
    }
    Ok(body)
}

#[tauri::command]
fn api_key_status(
    state: State<'_, YouTubeState>,
    storage: State<'_, ApiKeyStorageState>,
) -> Result<ApiKeyStatus, String> {
    let configured = state
        .api_key
        .read()
        .map_err(|_| "API key storage is temporarily unavailable".to_string())?
        .is_some();
    Ok(ApiKeyStatus {
        configured,
        persisted: storage.0.is_file(),
    })
}

#[tauri::command]
fn set_api_key(
    state: State<'_, YouTubeState>,
    storage: State<'_, ApiKeyStorageState>,
    input: ApiKeyInput,
) -> Result<(), String> {
    let normalized = normalize_api_key(&input.api_key)?;
    let protected = protect_secret(&normalized)?;
    fs::write(&storage.0, protected)
        .map_err(|_| "ANON could not save the protected API key".to_string())?;
    let mut key = state
        .api_key
        .write()
        .map_err(|_| "API key storage is temporarily unavailable".to_string())?;
    *key = Some(normalized);
    Ok(())
}

#[tauri::command]
fn remove_api_key(
    state: State<'_, YouTubeState>,
    storage: State<'_, ApiKeyStorageState>,
) -> Result<(), String> {
    match fs::remove_file(&storage.0) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(_) => return Err("ANON could not remove the protected API key".into()),
    }
    let mut key = state
        .api_key
        .write()
        .map_err(|_| "API key storage is temporarily unavailable".to_string())?;
    *key = None;
    Ok(())
}

#[tauri::command]
async fn youtube_search(
    state: State<'_, YouTubeState>,
    query: String,
    page_token: Option<String>,
) -> Result<Value, String> {
    let normalized = query.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() || normalized.chars().count() > 120 {
        return Err("Search query must contain 1 to 120 characters".into());
    }
    validate_page_token(&page_token)?;
    let mut search_query = vec![
        ("part", "snippet".into()),
        ("type", "video".into()),
        ("videoEmbeddable", "true".into()),
        ("videoSyndicated", "true".into()),
        ("safeSearch", "moderate".into()),
        ("maxResults", "24".into()),
        ("q", normalized),
    ];
    if let Some(token) = page_token {
        search_query.push(("pageToken", token));
    }
    let search = google_json(&state, "search", &search_query).await?;
    let ids: Vec<String> = search
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.pointer("/id/videoId").and_then(Value::as_str))
        .filter(|id| valid_video_id(id))
        .map(str::to_owned)
        .collect();
    if ids.is_empty() {
        return Ok(serde_json::json!({
            "items": [],
            "nextPageToken": search.get("nextPageToken").cloned().unwrap_or(Value::Null),
        }));
    }
    let videos = google_json(
        &state,
        "videos",
        &[
            ("part", "snippet,contentDetails,statistics,status".into()),
            ("id", ids.join(",")),
        ],
    )
    .await?;
    let ordered = ordered_resource_items(&ids, &videos);
    Ok(serde_json::json!({
        "items": ordered,
        "nextPageToken": search.get("nextPageToken").cloned().unwrap_or(Value::Null),
    }))
}

#[tauri::command]
async fn youtube_video(state: State<'_, YouTubeState>, video_id: String) -> Result<Value, String> {
    if !valid_video_id(&video_id) {
        return Err("Invalid video ID".into());
    }
    let response = google_json(
        &state,
        "videos",
        &[
            ("part", "snippet,contentDetails,statistics,status".into()),
            ("id", video_id),
        ],
    )
    .await?;
    response
        .get("items")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .cloned()
        .ok_or_else(|| "Video not found or unavailable".into())
}

#[tauri::command]
async fn youtube_channel_search(
    state: State<'_, YouTubeState>,
    query: String,
    page_token: Option<String>,
) -> Result<Value, String> {
    let normalized = query.split_whitespace().collect::<Vec<_>>().join(" ");
    if normalized.is_empty() || normalized.chars().count() > 120 {
        return Err("Search query must contain 1 to 120 characters".into());
    }
    validate_page_token(&page_token)?;
    let mut search_query = vec![
        ("part", "snippet".into()),
        ("type", "channel".into()),
        ("safeSearch", "moderate".into()),
        ("maxResults", "18".into()),
        ("q", normalized),
    ];
    if let Some(token) = page_token {
        search_query.push(("pageToken", token));
    }
    let search = google_json(&state, "search", &search_query).await?;
    let ids: Vec<String> = search
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| item.pointer("/id/channelId").and_then(Value::as_str))
        .filter(|id| valid_channel_id(id))
        .map(str::to_owned)
        .collect();
    if ids.is_empty() {
        return Ok(serde_json::json!({
            "items": [],
            "nextPageToken": search.get("nextPageToken").cloned().unwrap_or(Value::Null),
        }));
    }
    let channels = google_json(
        &state,
        "channels",
        &[
            (
                "part",
                "snippet,statistics,contentDetails,brandingSettings".into(),
            ),
            ("id", ids.join(",")),
        ],
    )
    .await?;
    Ok(serde_json::json!({
        "items": ordered_resource_items(&ids, &channels),
        "nextPageToken": search.get("nextPageToken").cloned().unwrap_or(Value::Null),
    }))
}

#[tauri::command]
async fn youtube_channel(
    state: State<'_, YouTubeState>,
    channel_id: String,
) -> Result<Value, String> {
    if !valid_channel_id(&channel_id) {
        return Err("Invalid channel ID".into());
    }
    let response = google_json(
        &state,
        "channels",
        &[
            (
                "part",
                "snippet,statistics,contentDetails,brandingSettings".into(),
            ),
            ("id", channel_id),
        ],
    )
    .await?;
    response
        .get("items")
        .and_then(Value::as_array)
        .and_then(|items| items.first())
        .cloned()
        .ok_or_else(|| "Channel not found or unavailable".into())
}

#[tauri::command]
async fn youtube_channel_uploads(
    state: State<'_, YouTubeState>,
    uploads_playlist_id: String,
    page_token: Option<String>,
) -> Result<Value, String> {
    if !valid_playlist_id(&uploads_playlist_id) {
        return Err("Invalid uploads playlist ID".into());
    }
    validate_page_token(&page_token)?;
    let mut playlist_query = vec![
        ("part", "snippet,contentDetails".into()),
        ("playlistId", uploads_playlist_id),
        ("maxResults", "24".into()),
    ];
    if let Some(token) = page_token {
        playlist_query.push(("pageToken", token));
    }
    let playlist = google_json(&state, "playlistItems", &playlist_query).await?;
    let ids: Vec<String> = playlist
        .get("items")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|item| {
            item.pointer("/contentDetails/videoId")
                .or_else(|| item.pointer("/snippet/resourceId/videoId"))
                .and_then(Value::as_str)
        })
        .filter(|id| valid_video_id(id))
        .map(str::to_owned)
        .collect();
    if ids.is_empty() {
        return Ok(serde_json::json!({
            "items": [],
            "nextPageToken": playlist.get("nextPageToken").cloned().unwrap_or(Value::Null),
        }));
    }
    let videos = google_json(
        &state,
        "videos",
        &[
            ("part", "snippet,contentDetails,statistics,status".into()),
            ("id", ids.join(",")),
        ],
    )
    .await?;
    Ok(serde_json::json!({
        "items": ordered_resource_items(&ids, &videos),
        "nextPageToken": playlist.get("nextPageToken").cloned().unwrap_or(Value::Null),
    }))
}

fn epoch_seconds() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or_default()
}

fn migrate(connection: &mut Connection) -> Result<(), rusqlite::Error> {
    connection.busy_timeout(Duration::from_secs(5))?;
    connection.pragma_update(None, "foreign_keys", "ON")?;
    connection.pragma_update(None, "journal_mode", "WAL")?;
    connection.pragma_update(None, "secure_delete", "ON")?;
    let version: i64 = connection.pragma_query_value(None, "user_version", |row| row.get(0))?;
    if version > 1 {
        return Err(rusqlite::Error::InvalidQuery);
    }
    let transaction = connection.transaction()?;
    transaction.execute_batch(
        "CREATE TABLE IF NOT EXISTS video_cache (
           id TEXT PRIMARY KEY,
           title TEXT NOT NULL,
           channel_id TEXT NOT NULL,
           channel TEXT NOT NULL,
           thumbnail TEXT NOT NULL,
           published_at TEXT,
           duration_seconds INTEGER,
           view_count INTEGER,
           description TEXT,
           updated_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS watch_history (
           video_id TEXT PRIMARY KEY REFERENCES video_cache(id) ON DELETE CASCADE,
           watched_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_watch_history_time ON watch_history(watched_at DESC);
         CREATE TABLE IF NOT EXISTS search_history (
           query TEXT PRIMARY KEY COLLATE NOCASE,
           searched_at INTEGER NOT NULL
         );
         CREATE INDEX IF NOT EXISTS idx_search_history_time ON search_history(searched_at DESC);
         CREATE TABLE IF NOT EXISTS followed_channels (
           channel_id TEXT PRIMARY KEY,
           name TEXT NOT NULL,
           avatar TEXT,
           followed_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS playback_progress (
           video_id TEXT PRIMARY KEY REFERENCES video_cache(id) ON DELETE CASCADE,
           position_seconds INTEGER NOT NULL DEFAULT 0,
           updated_at INTEGER NOT NULL
         );
         CREATE TABLE IF NOT EXISTS settings (
           key TEXT PRIMARY KEY,
           value_json TEXT NOT NULL
         );
         CREATE TABLE IF NOT EXISTS cached_searches (
           cache_key TEXT PRIMARY KEY,
           payload_json TEXT NOT NULL,
           expires_at INTEGER NOT NULL
         );
         PRAGMA user_version = 1;",
    )?;
    transaction.commit()
}

fn open_database(path: &Path) -> Result<(Connection, Option<String>), rusqlite::Error> {
    match Connection::open(path) {
        Ok(mut connection) => match migrate(&mut connection) {
            Ok(()) => Ok((connection, None)),
            Err(_) => {
                let mut fallback = Connection::open_in_memory()?;
                migrate(&mut fallback)?;
                Ok((
                    fallback,
                    Some("ANON could not use its local database. The original file was preserved, and this session is using temporary storage. Restart after backing up the app-data folder or reinstalling ANON.".into()),
                ))
            }
        },
        Err(_) => {
            let mut fallback = Connection::open_in_memory()?;
            migrate(&mut fallback)?;
            Ok((
                fallback,
                Some("ANON could not open its local database. The original file was left untouched, and this session is using temporary storage.".into()),
            ))
        }
    }
}

fn upsert_video(connection: &Connection, video: &VideoRecord) -> Result<(), rusqlite::Error> {
    connection.execute(
        "INSERT INTO video_cache (
           id, title, channel_id, channel, thumbnail, published_at,
           duration_seconds, view_count, description, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title, channel_id = excluded.channel_id,
           channel = excluded.channel, thumbnail = excluded.thumbnail,
           published_at = excluded.published_at, duration_seconds = excluded.duration_seconds,
           view_count = excluded.view_count, description = excluded.description,
           updated_at = excluded.updated_at",
        params![
            video.id,
            video.title,
            video.channel_id,
            video.channel,
            video.thumbnail,
            video.published_at,
            video.duration_seconds,
            video.view_count,
            video.description,
            epoch_seconds(),
        ],
    )?;
    Ok(())
}

fn history(connection: &Connection) -> Result<Vec<HistoryRecord>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT v.id, v.title, v.channel_id, v.channel, v.thumbnail, v.published_at,
                v.duration_seconds, v.view_count, v.description, h.watched_at,
                COALESCE(p.position_seconds, 0)
         FROM watch_history h
         JOIN video_cache v ON v.id = h.video_id
         LEFT JOIN playback_progress p ON p.video_id = h.video_id
         ORDER BY h.watched_at DESC LIMIT 1000",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(HistoryRecord {
            video: VideoRecord {
                id: row.get(0)?,
                title: row.get(1)?,
                channel_id: row.get(2)?,
                channel: row.get(3)?,
                thumbnail: row.get(4)?,
                published_at: row.get(5)?,
                duration_seconds: row.get(6)?,
                view_count: row.get(7)?,
                description: row.get(8)?,
            },
            watched_at: row.get(9)?,
            position_seconds: row.get(10)?,
        })
    })?;
    rows.collect()
}

fn follows(connection: &Connection) -> Result<Vec<ChannelRecord>, rusqlite::Error> {
    let mut statement = connection.prepare(
        "SELECT channel_id, name, avatar, followed_at FROM followed_channels ORDER BY followed_at DESC LIMIT 1000",
    )?;
    let rows = statement.query_map([], |row| {
        Ok(ChannelRecord {
            id: row.get(0)?,
            name: row.get(1)?,
            avatar: row.get(2)?,
            followed_at: row.get(3)?,
        })
    })?;
    rows.collect()
}

#[tauri::command]
fn get_bootstrap(state: State<'_, DbState>) -> Result<Bootstrap, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let mut statement = connection
        .prepare("SELECT key, value_json FROM settings")
        .map_err(|e| e.to_string())?;
    let pairs = statement
        .query_map([], |row| {
            let key: String = row.get(0)?;
            let raw: String = row.get(1)?;
            Ok((key, raw))
        })
        .map_err(|e| e.to_string())?;
    let mut settings = HashMap::new();
    for pair in pairs {
        let (key, raw) = pair.map_err(|e| e.to_string())?;
        if let Ok(value) = serde_json::from_str(&raw) {
            settings.insert(key, value);
        }
    }
    Ok(Bootstrap {
        settings,
        history: history(&connection).map_err(|e| e.to_string())?,
        follows: follows(&connection).map_err(|e| e.to_string())?,
        startup_notice: state.1.clone(),
    })
}

#[tauri::command]
fn record_watch(state: State<'_, DbState>, input: VideoRecord) -> Result<(), String> {
    validate_video(&input)?;
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|_| "Local history could not be updated".to_string())?;
    upsert_video(&transaction, &input)
        .map_err(|_| "Local history could not be updated".to_string())?;
    transaction
        .execute(
            "INSERT INTO watch_history(video_id, watched_at) VALUES (?1, ?2)
         ON CONFLICT(video_id) DO UPDATE SET watched_at = excluded.watched_at",
            params![input.id, epoch_seconds()],
        )
        .map_err(|_| "Local history could not be updated".to_string())?;
    transaction
        .commit()
        .map_err(|_| "Local history could not be updated".to_string())
}

#[tauri::command]
fn update_progress(state: State<'_, DbState>, input: ProgressInput) -> Result<(), String> {
    if !valid_video_id(&input.video_id) || !(0..=604_800).contains(&input.position_seconds) {
        return Err("Invalid playback progress".into());
    }
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    connection.execute(
        "INSERT INTO playback_progress(video_id, position_seconds, updated_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(video_id) DO UPDATE SET position_seconds = excluded.position_seconds, updated_at = excluded.updated_at",
        params![input.video_id, input.position_seconds.max(0), epoch_seconds()],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_history(state: State<'_, DbState>, video_id: String) -> Result<(), String> {
    if !valid_video_id(&video_id) {
        return Err("Invalid video ID".into());
    }
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|_| "Local history could not be updated".to_string())?;
    transaction
        .execute("DELETE FROM watch_history WHERE video_id = ?1", [&video_id])
        .map_err(|_| "Local history could not be updated".to_string())?;
    transaction
        .execute(
            "DELETE FROM playback_progress WHERE video_id = ?1",
            [&video_id],
        )
        .map_err(|_| "Local history could not be updated".to_string())?;
    transaction
        .commit()
        .map_err(|_| "Local history could not be updated".to_string())
}

#[tauri::command]
fn clear_history(state: State<'_, DbState>) -> Result<(), String> {
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let transaction = connection
        .transaction()
        .map_err(|_| "Local history could not be cleared".to_string())?;
    transaction
        .execute("DELETE FROM watch_history", [])
        .map_err(|_| "Local history could not be cleared".to_string())?;
    transaction
        .execute("DELETE FROM playback_progress", [])
        .map_err(|_| "Local history could not be cleared".to_string())?;
    transaction
        .commit()
        .map_err(|_| "Local history could not be cleared".to_string())
}

#[tauri::command]
fn record_search(state: State<'_, DbState>, input: SearchInput) -> Result<(), String> {
    let query = input.query.split_whitespace().collect::<Vec<_>>().join(" ");
    if query.is_empty() || query.chars().count() > 120 {
        return Err("Invalid search query".into());
    }
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    connection
        .execute(
            "INSERT INTO search_history(query, searched_at) VALUES (?1, ?2)
         ON CONFLICT(query) DO UPDATE SET searched_at = excluded.searched_at",
            params![query, epoch_seconds()],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_cached_search(
    state: State<'_, DbState>,
    cache_key: String,
) -> Result<Option<Value>, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let raw: Option<String> = connection
        .query_row(
            "SELECT payload_json FROM cached_searches WHERE cache_key = ?1 AND expires_at > ?2",
            params![cache_key, epoch_seconds()],
            |row| row.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;
    Ok(raw.and_then(|value| serde_json::from_str(&value).ok()))
}

#[tauri::command]
fn set_cached_search(state: State<'_, DbState>, input: CacheInput) -> Result<(), String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let payload = serde_json::to_string(&input.payload).map_err(|e| e.to_string())?;
    if input.cache_key.is_empty() || input.cache_key.len() > 400 || payload.len() > 2_000_000 {
        return Err("Search cache entry exceeded safe limits".into());
    }
    connection.execute(
        "INSERT INTO cached_searches(cache_key, payload_json, expires_at) VALUES (?1, ?2, ?3)
         ON CONFLICT(cache_key) DO UPDATE SET payload_json = excluded.payload_json, expires_at = excluded.expires_at",
            params![input.cache_key, payload, epoch_seconds() + 1_800],
    ).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn toggle_follow(
    state: State<'_, DbState>,
    input: ChannelRecord,
    followed: bool,
) -> Result<(), String> {
    if !valid_channel_id(&input.id) || input.name.is_empty() || input.name.chars().count() > 200 {
        return Err("Invalid channel data".into());
    }
    if input
        .avatar
        .as_ref()
        .is_some_and(|value| value.len() > 1000 || !value.starts_with("https://yt3.ggpht.com/"))
    {
        return Err("Channel avatar address was not allowed".into());
    }
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    if followed {
        connection.execute(
            "INSERT INTO followed_channels(channel_id, name, avatar, followed_at) VALUES (?1, ?2, ?3, ?4)
             ON CONFLICT(channel_id) DO UPDATE SET name = excluded.name, avatar = excluded.avatar",
            params![input.id, input.name, input.avatar, epoch_seconds()],
        )
    } else {
        connection.execute("DELETE FROM followed_channels WHERE channel_id = ?1", [input.id])
    }.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn set_setting(state: State<'_, DbState>, input: SettingInput) -> Result<(), String> {
    let valid = match input.key.as_str() {
        "theme" => input
            .value
            .as_str()
            .is_some_and(|value| value == "dark" || value == "system"),
        "autoplay" | "historyEnabled" | "searchHistoryEnabled" | "reducedMotion" => {
            input.value.is_boolean()
        }
        "defaultPlaybackSpeed" => input
            .value
            .as_f64()
            .is_some_and(|value| [0.5, 0.75, 1.0, 1.25, 1.5, 2.0].contains(&value)),
        _ => false,
    };
    if !valid {
        return Err("Unsupported setting value".into());
    }
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let value = serde_json::to_string(&input.value).map_err(|e| e.to_string())?;
    connection
        .execute(
            "INSERT INTO settings(key, value_json) VALUES (?1, ?2)
         ON CONFLICT(key) DO UPDATE SET value_json = excluded.value_json",
            params![input.key, value],
        )
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn get_stats(app: tauri::AppHandle, state: State<'_, DbState>) -> Result<PrivacyStats, String> {
    let connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let history_count = connection
        .query_row("SELECT COUNT(*) FROM watch_history", [], |row| row.get(0))
        .map_err(|e| e.to_string())?;
    let follow_count = connection
        .query_row("SELECT COUNT(*) FROM followed_channels", [], |row| {
            row.get(0)
        })
        .map_err(|e| e.to_string())?;
    let approximate_bytes = app
        .path()
        .app_data_dir()
        .ok()
        .map(|path| {
            ["anon.db", "anon.db-wal", "anon.db-shm"]
                .iter()
                .filter_map(|name| fs::metadata(path.join(name)).ok())
                .map(|metadata| metadata.len())
                .sum()
        })
        .unwrap_or_default();
    Ok(PrivacyStats {
        history_count,
        follow_count,
        approximate_bytes,
    })
}

#[tauri::command]
fn clear_local_data(state: State<'_, DbState>) -> Result<(), String> {
    let mut connection = state
        .0
        .lock()
        .map_err(|_| "Local database is unavailable".to_string())?;
    let transaction = connection.transaction().map_err(|e| e.to_string())?;
    transaction.execute_batch(
        "DELETE FROM watch_history; DELETE FROM search_history; DELETE FROM followed_channels;
         DELETE FROM playback_progress; DELETE FROM settings; DELETE FROM cached_searches; DELETE FROM video_cache;",
    ).map_err(|e| e.to_string())?;
    transaction
        .commit()
        .map_err(|_| "Local data transaction could not be completed".to_string())?;
    let _ = connection.execute_batch("PRAGMA wal_checkpoint(TRUNCATE); VACUUM;");
    Ok(())
}

#[cfg(windows)]
fn show_startup_error() {
    use windows_sys::Win32::UI::WindowsAndMessaging::{MessageBoxW, MB_ICONERROR, MB_OK};

    let message: Vec<u16> = "ANON could not start. Restart Windows and try again, or reinstall ANON. Your local data was not sent anywhere.\0"
        .encode_utf16()
        .collect();
    let title: Vec<u16> = "ANON Alpha 0.1.0\0".encode_utf16().collect();
    unsafe {
        MessageBoxW(
            std::ptr::null_mut(),
            message.as_ptr(),
            title.as_ptr(),
            MB_OK | MB_ICONERROR,
        )
    };
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(15))
        .user_agent("ANON/0.1.0-alpha (Windows desktop)")
        .build()
        .unwrap_or_else(|_| reqwest::Client::new());
    let api_key = std::env::var("YOUTUBE_API_KEY")
        .ok()
        .and_then(|value| normalize_api_key(&value).ok());
    let result = tauri::Builder::default()
        .manage(YouTubeState {
            client,
            api_key: RwLock::new(api_key),
        })
        .setup(|app| {
            let app_data = app.path().app_data_dir()?;
            fs::create_dir_all(&app_data)?;
            let key_path = app_data.join("youtube-api-key.bin");
            let mut notices = Vec::new();
            match load_protected_api_key(&key_path) {
                Ok(Some(api_key)) => {
                    if let Ok(mut key) = app.state::<YouTubeState>().api_key.write() {
                        *key = Some(api_key);
                    }
                }
                Ok(None) => {}
                Err(_) => notices.push("ANON could not read the protected YouTube API key. Add it again in Settings; the unreadable file was preserved.".to_string()),
            }
            app.manage(ApiKeyStorageState(key_path));
            let (connection, database_notice) = open_database(&app_data.join("anon.db"))?;
            if let Some(notice) = database_notice {
                notices.push(notice);
            }
            app.manage(DbState(
                Mutex::new(connection),
                (!notices.is_empty()).then(|| notices.join(" ")),
            ));
            #[cfg(windows)]
            if let Some(main) = app.get_webview_window("main") {
                install_youtube_referer(&main)?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_bootstrap,
            record_watch,
            update_progress,
            delete_history,
            clear_history,
            record_search,
            get_cached_search,
            set_cached_search,
            toggle_follow,
            set_setting,
            get_stats,
            clear_local_data,
            youtube_search,
            youtube_video,
            youtube_channel_search,
            youtube_channel,
            youtube_channel_uploads,
            api_key_status,
            set_api_key,
            remove_api_key,
        ])
        .run(tauri::generate_context!());
    if let Err(_error) = result {
        #[cfg(debug_assertions)]
        eprintln!("ANON failed to start: {_error}");
        #[cfg(windows)]
        show_startup_error();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn migrations_are_repeatable() {
        let mut connection = Connection::open_in_memory().unwrap();
        migrate(&mut connection).unwrap();
        migrate(&mut connection).unwrap();
        let version: i64 = connection
            .query_row("PRAGMA user_version", [], |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
    }

    #[test]
    fn on_disk_database_enables_required_pragmas() {
        let path = std::env::temp_dir().join(format!(
            "anon-migration-{}-{}.db",
            std::process::id(),
            epoch_seconds()
        ));
        let mut connection = Connection::open(&path).unwrap();
        migrate(&mut connection).unwrap();
        let foreign_keys: i64 = connection
            .pragma_query_value(None, "foreign_keys", |row| row.get(0))
            .unwrap();
        let journal_mode: String = connection
            .pragma_query_value(None, "journal_mode", |row| row.get(0))
            .unwrap();
        assert_eq!(foreign_keys, 1);
        assert_eq!(journal_mode.to_ascii_lowercase(), "wal");
        drop(connection);
        let _ = std::fs::remove_file(&path);
        let _ = std::fs::remove_file(path.with_extension("db-wal"));
        let _ = std::fs::remove_file(path.with_extension("db-shm"));
    }

    #[test]
    fn recording_history_is_an_upsert() {
        let mut connection = Connection::open_in_memory().unwrap();
        migrate(&mut connection).unwrap();
        let video = VideoRecord {
            id: "abc123def45".into(),
            title: "One".into(),
            channel_id: "UC123".into(),
            channel: "Channel".into(),
            thumbnail: "https://i.ytimg.com/vi/abc123def45/hqdefault.jpg".into(),
            published_at: None,
            duration_seconds: Some(90),
            view_count: None,
            description: None,
        };
        upsert_video(&connection, &video).unwrap();
        connection
            .execute(
                "INSERT INTO watch_history(video_id, watched_at) VALUES (?1, 1)",
                [&video.id],
            )
            .unwrap();
        connection
            .execute(
                "UPDATE watch_history SET watched_at = 2 WHERE video_id = ?1",
                [&video.id],
            )
            .unwrap();
        let items = history(&connection).unwrap();
        assert_eq!(items.len(), 1);
        assert_eq!(items[0].watched_at, 2);
    }

    #[test]
    fn channel_and_playlist_identifiers_are_bounded() {
        assert!(valid_channel_id("UC_x7h8fMq-W5AYjHZ9t6Q"));
        assert!(!valid_channel_id("../channel"));
        assert!(valid_playlist_id("UU_x7h8fMq-W5AYjHZ9t6Q"));
        assert!(!valid_playlist_id("uploads/../private"));
    }

    #[test]
    fn remote_resources_preserve_search_order_and_drop_missing_rows() {
        let response = serde_json::json!({
            "items": [{ "id": "third" }, { "id": "first" }]
        });
        let ids = vec![
            "first".to_string(),
            "second".to_string(),
            "third".to_string(),
        ];
        let ordered = ordered_resource_items(&ids, &response);
        assert_eq!(ordered.len(), 2);
        assert_eq!(ordered[0]["id"], "first");
        assert_eq!(ordered[1]["id"], "third");
    }

    #[test]
    fn api_keys_are_trimmed_and_bounded_without_logging_values() {
        let normalized = normalize_api_key("  AIzaExampleKeyWithEnoughCharacters12345  ").unwrap();
        assert_eq!(normalized.len(), 39);
        assert!(normalize_api_key("too short").is_err());
        assert!(normalize_api_key("AIza key with spaces and enough characters").is_err());
    }

    #[test]
    fn corrupt_database_falls_back_without_overwriting_the_original() {
        let path = std::env::temp_dir().join(format!(
            "anon-corrupt-{}-{}.db",
            std::process::id(),
            epoch_seconds()
        ));
        let original = b"not a sqlite database";
        std::fs::write(&path, original).unwrap();
        let (connection, notice) = open_database(&path).unwrap();
        assert!(notice.is_some());
        let version: i64 = connection
            .pragma_query_value(None, "user_version", |row| row.get(0))
            .unwrap();
        assert_eq!(version, 1);
        assert_eq!(std::fs::read(&path).unwrap(), original);
        drop(connection);
        let _ = std::fs::remove_file(&path);
    }

    #[cfg(windows)]
    #[test]
    fn windows_dpapi_round_trip_keeps_the_key_out_of_plaintext_storage() {
        let secret = "AIzaExampleKeyWithEnoughCharacters12345";
        let protected = protect_secret(secret).unwrap();
        assert_ne!(protected, secret.as_bytes());
        assert_eq!(unprotect_secret(&protected).unwrap(), secret);
    }

    #[cfg(windows)]
    #[test]
    fn youtube_referer_scope_is_exact() {
        assert!(is_youtube_embed_document(
            "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
        ));
        assert!(!is_youtube_embed_document(
            "https://youtube-nocookie.com/embed/dQw4w9WgXcQ"
        ));
        assert!(!is_youtube_embed_document(
            "https://www.youtube-nocookie.com.evil.example/embed/dQw4w9WgXcQ"
        ));
        assert!(!is_youtube_embed_document(
            "https://www.youtube-nocookie.com/embed/not-valid"
        ));
    }
}
