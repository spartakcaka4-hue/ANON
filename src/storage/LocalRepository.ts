import type { ApiKeyStatus, AppSettings, BootstrapData, FollowedChannel, PrivacyStats, Video } from '../domain/types';

export interface LocalRepository {
  initialize(): Promise<BootstrapData>;
  recordWatch(video: Video): Promise<void>;
  updateProgress(videoId: string, positionSeconds: number): Promise<void>;
  deleteHistory(videoId: string): Promise<void>;
  clearHistory(): Promise<void>;
  recordSearch(query: string): Promise<void>;
  getCachedSearch<T>(cacheKey: string): Promise<T | null>;
  setCachedSearch<T>(cacheKey: string, page: T): Promise<void>;
  toggleFollow(channel: FollowedChannel, followed: boolean): Promise<void>;
  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  getStats(): Promise<PrivacyStats>;
  clearLocalData(): Promise<void>;
  getApiKeyStatus(): Promise<ApiKeyStatus>;
  setApiKey(apiKey: string): Promise<void>;
  removeApiKey(): Promise<void>;
}
