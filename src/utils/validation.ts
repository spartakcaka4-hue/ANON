const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;
const CHANNEL_ID = /^[A-Za-z0-9_-]{3,64}$/;
const ALLOWED_IMAGES = new Set(['i.ytimg.com', 'yt3.ggpht.com', 'yt3.googleusercontent.com']);

export function isVideoId(value: string): boolean {
  return VIDEO_ID.test(value);
}

export function isChannelId(value: string): boolean {
  return CHANNEL_ID.test(value);
}

export function safeThumbnail(value: string): string | null {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && ALLOWED_IMAGES.has(url.hostname) ? url.href : null;
  } catch {
    return null;
  }
}

export function normalizeQuery(value: string): string {
  return value.trim().replace(/\s+/g, ' ').slice(0, 120);
}

export function searchCacheKey(query: string, type: 'videos' | 'channels', pageToken?: string): string {
  return `search::${type}::${normalizeQuery(query).toLocaleLowerCase()}::${pageToken ?? 'first'}`;
}
