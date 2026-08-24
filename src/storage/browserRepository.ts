import type { ApiKeyStatus, AppSettings, BootstrapData, FollowedChannel, PrivacyStats, Video } from '../domain/types';
import type { LocalRepository } from './LocalRepository';

interface BrowserData extends BootstrapData {
  cache: Record<string, { page: unknown; expiresAt: number }>;
}

const STORAGE_KEY = 'anon:local-data:v1';
const EMPTY: BrowserData = { settings: {}, history: [], follows: [], cache: {} };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function read(): BrowserData {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (!isRecord(parsed)) return structuredClone(EMPTY);
    return {
      settings: isRecord(parsed.settings) ? parsed.settings as Partial<AppSettings> : {},
      history: Array.isArray(parsed.history) ? parsed.history : [],
      follows: Array.isArray(parsed.follows) ? parsed.follows : [],
      cache: isRecord(parsed.cache) ? parsed.cache as BrowserData['cache'] : {},
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(data: BrowserData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export class BrowserRepository implements LocalRepository {
  async initialize(): Promise<BootstrapData> {
    const { settings, history, follows } = read();
    return { settings, history, follows };
  }

  async recordWatch(video: Video): Promise<void> {
    const data = read();
    const prior = data.history.find((entry) => entry.id === video.id);
    data.history = [{ ...video, watchedAt: Math.floor(Date.now() / 1000), positionSeconds: prior?.positionSeconds ?? 0 }, ...data.history.filter((entry) => entry.id !== video.id)];
    write(data);
  }

  async updateProgress(videoId: string, positionSeconds: number): Promise<void> {
    const data = read();
    data.history = data.history.map((entry) => entry.id === videoId ? { ...entry, positionSeconds: Math.max(0, Math.floor(positionSeconds)) } : entry);
    write(data);
  }

  async deleteHistory(videoId: string): Promise<void> {
    const data = read();
    data.history = data.history.filter((entry) => entry.id !== videoId);
    write(data);
  }

  async clearHistory(): Promise<void> {
    const data = read();
    data.history = [];
    write(data);
  }

  async recordSearch(): Promise<void> { /* Search terms are not surfaced in browser dev yet. */ }

  async getCachedSearch<T>(cacheKey: string): Promise<T | null> {
    const entry = read().cache[cacheKey];
    return entry && typeof entry.expiresAt === 'number' && entry.expiresAt > Date.now()
      ? entry.page as T
      : null;
  }

  async setCachedSearch<T>(cacheKey: string, page: T): Promise<void> {
    const data = read();
    data.cache[cacheKey] = { page, expiresAt: Date.now() + 30 * 60 * 1000 };
    write(data);
  }

  async toggleFollow(channel: FollowedChannel, followed: boolean): Promise<void> {
    const data = read();
    data.follows = followed ? [channel, ...data.follows.filter((item) => item.id !== channel.id)] : data.follows.filter((item) => item.id !== channel.id);
    write(data);
  }

  async setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
    const data = read();
    data.settings = { ...data.settings, [key]: value };
    write(data);
  }

  async getStats(): Promise<PrivacyStats> {
    const raw = localStorage.getItem(STORAGE_KEY) ?? '';
    const data = read();
    return { historyCount: data.history.length, followCount: data.follows.length, approximateBytes: new Blob([raw]).size };
  }

  async clearLocalData(): Promise<void> {
    localStorage.removeItem(STORAGE_KEY);
  }

  async getApiKeyStatus(): Promise<ApiKeyStatus> {
    return { configured: false, persisted: false };
  }

  async setApiKey(): Promise<void> {
    throw new Error('API-key storage is available in the native ANON app only.');
  }

  async removeApiKey(): Promise<void> {
    throw new Error('API-key storage is available in the native ANON app only.');
  }
}
