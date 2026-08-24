import { invoke } from '@tauri-apps/api/core';
import type { Channel, ChannelSearchPage, ChannelUploadsPage, SearchPage, Video } from '../../domain/types';
import { parseIsoDuration } from '../../utils/format';
import { isChannelId, isVideoId, safeThumbnail } from '../../utils/validation';
import { YouTubeError, type YouTubeProvider } from './YouTubeProvider';

interface ApiVideo {
  id: string;
  snippet: {
    title: string;
    channelId: string;
    channelTitle: string;
    description?: string;
    publishedAt?: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
  contentDetails?: { duration?: string };
  statistics?: { viewCount?: string };
  status?: { madeForKids?: boolean };
}

interface ApiSearchResponse {
  items: ApiVideo[];
  nextPageToken?: string;
}

interface ApiChannel {
  id: string;
  snippet?: {
    title?: string;
    customUrl?: string;
    description?: string;
    thumbnails?: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
  };
  statistics?: {
    subscriberCount?: string;
    hiddenSubscriberCount?: boolean;
    videoCount?: string;
  };
  contentDetails?: { relatedPlaylists?: { uploads?: string } };
  brandingSettings?: { image?: { bannerExternalUrl?: string } };
}

interface ApiChannelSearchResponse {
  items: ApiChannel[];
  nextPageToken?: string;
}

function mapVideo(item: ApiVideo): Video {
  const thumbnail = item.snippet.thumbnails?.high?.url
    ?? item.snippet.thumbnails?.medium?.url
    ?? item.snippet.thumbnails?.default?.url
    ?? '';
  const parsedViews = Number(item.statistics?.viewCount);
  if (!isVideoId(item.id) || !item.snippet?.title || !item.snippet.channelId || !safeThumbnail(thumbnail)) {
    throw new YouTubeError('malformed', 'YouTube returned a result ANON could not safely display.');
  }
  return {
    id: item.id,
    title: item.snippet.title,
    channelId: item.snippet.channelId,
    channel: item.snippet.channelTitle,
    thumbnail,
    publishedAt: item.snippet.publishedAt ?? null,
    durationSeconds: parseIsoDuration(item.contentDetails?.duration),
    viewCount: Number.isSafeInteger(parsedViews) ? parsedViews : null,
    description: item.snippet.description ?? null,
    madeForKids: item.status?.madeForKids ?? null,
  };
}

function safeCount(value?: string): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export function mapChannel(item: ApiChannel): Channel {
  const name = item.snippet?.title?.trim() ?? '';
  const avatarCandidate = item.snippet?.thumbnails?.high?.url
    ?? item.snippet?.thumbnails?.medium?.url
    ?? item.snippet?.thumbnails?.default?.url
    ?? '';
  if (!isChannelId(item.id) || !name) {
    throw new YouTubeError('malformed', 'YouTube returned a channel ANON could not safely display.');
  }
  const customUrl = item.snippet?.customUrl?.trim() || null;
  const banner = safeThumbnail(item.brandingSettings?.image?.bannerExternalUrl ?? '');
  return {
    id: item.id,
    name,
    handle: customUrl ? (customUrl.startsWith('@') ? customUrl : `@${customUrl}`) : null,
    description: item.snippet?.description?.trim() || null,
    avatar: safeThumbnail(avatarCandidate),
    banner,
    subscriberCount: item.statistics?.hiddenSubscriberCount ? null : safeCount(item.statistics?.subscriberCount),
    videoCount: safeCount(item.statistics?.videoCount),
    uploadsPlaylistId: item.contentDetails?.relatedPlaylists?.uploads?.trim() || null,
  };
}

function normalizeError(error: unknown): never {
  if (error instanceof YouTubeError) throw error;
  const message = error instanceof Error ? error.message : String(error);
  const normalized = message.toLowerCase();
  if (normalized.includes('api key') || normalized.includes('keyinvalid') || normalized.includes('accessnotconfigured') || normalized.includes('configuration')) {
    throw new YouTubeError('configuration', 'YouTube access needs a local API key. See Settings → YouTube access.');
  }
  if (normalized.includes('quota') || normalized.includes('dailylimit') || normalized.includes('ratelimit') || normalized.includes('too many requests') || normalized.includes('429')) {
    throw new YouTubeError('quota', 'The YouTube API limit has been reached. Cached search results remain available; quota resets according to the Google Cloud project’s limits.');
  }
  if (normalized.includes('not found') || normalized.includes('unavailable')) {
    throw new YouTubeError('not-found', 'This YouTube item is missing, private, deleted, or unavailable.');
  }
  if (normalized.includes('network') || normalized.includes('fetch') || normalized.includes('timeout')) {
    throw new YouTubeError('network', 'ANON could not reach YouTube. Check your connection and try again.');
  }
  if (normalized.includes('malformed') || normalized.includes('invalid response')) {
    throw new YouTubeError('malformed', 'YouTube returned data ANON could not safely display. Try again later.');
  }
  throw new YouTubeError('unknown', 'YouTube could not complete this request. Try again in a moment.');
}

export class OfficialYouTubeProvider implements YouTubeProvider {
  async search(query: string, pageToken?: string): Promise<SearchPage> {
    try {
      if (!('__TAURI_INTERNALS__' in window)) {
        throw new YouTubeError('configuration', 'YouTube access is available in the native ANON app. Browser preview mode does not expose API keys or native commands.');
      }
      const response = await invoke<ApiSearchResponse>('youtube_search', { query, pageToken: pageToken ?? null });
      const items: Video[] = [];
      for (const item of response.items ?? []) {
        try { items.push(mapVideo(item)); } catch { /* Drop only the malformed remote row. */ }
      }
      return { items, nextPageToken: response.nextPageToken ?? null };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async searchChannels(query: string, pageToken?: string): Promise<ChannelSearchPage> {
    try {
      if (!('__TAURI_INTERNALS__' in window)) {
        throw new YouTubeError('configuration', 'Channel search is available in the native ANON app. Browser preview mode does not expose API keys or native commands.');
      }
      const response = await invoke<ApiChannelSearchResponse>('youtube_channel_search', { query, pageToken: pageToken ?? null });
      const items: Channel[] = [];
      for (const item of response.items ?? []) {
        try { items.push(mapChannel(item)); } catch { /* Drop only the malformed remote row. */ }
      }
      return { items, nextPageToken: response.nextPageToken ?? null };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async getChannel(channelId: string): Promise<Channel> {
    try {
      if (!('__TAURI_INTERNALS__' in window)) {
        throw new YouTubeError('configuration', 'Channel pages are available in the native ANON app.');
      }
      return mapChannel(await invoke<ApiChannel>('youtube_channel', { channelId }));
    } catch (error) {
      return normalizeError(error);
    }
  }

  async getChannelUploads(uploadsPlaylistId: string, pageToken?: string): Promise<ChannelUploadsPage> {
    try {
      if (!('__TAURI_INTERNALS__' in window)) {
        throw new YouTubeError('configuration', 'Channel uploads are available in the native ANON app.');
      }
      const response = await invoke<ApiSearchResponse>('youtube_channel_uploads', {
        uploadsPlaylistId,
        pageToken: pageToken ?? null,
      });
      const items: Video[] = [];
      for (const item of response.items ?? []) {
        try { items.push(mapVideo(item)); } catch { /* Drop only the malformed remote row. */ }
      }
      return { items, nextPageToken: response.nextPageToken ?? null };
    } catch (error) {
      return normalizeError(error);
    }
  }

  async getVideo(videoId: string): Promise<Video> {
    try {
      if (!('__TAURI_INTERNALS__' in window)) {
        throw new YouTubeError('configuration', 'YouTube access is available in the native ANON app.');
      }
      return mapVideo(await invoke<ApiVideo>('youtube_video', { videoId }));
    } catch (error) {
      return normalizeError(error);
    }
  }
}

export const youtubeProvider = new OfficialYouTubeProvider();
