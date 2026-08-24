import { invoke } from '@tauri-apps/api/core';
import type { ApiKeyStatus, AppSettings, BootstrapData, FollowedChannel, PrivacyStats, Video } from '../domain/types';
import type { LocalRepository } from './LocalRepository';

export class TauriRepository implements LocalRepository {
  initialize = () => invoke<BootstrapData>('get_bootstrap');
  recordWatch = (input: Video) => invoke<void>('record_watch', { input });
  updateProgress = (videoId: string, positionSeconds: number) => invoke<void>('update_progress', { input: { videoId, positionSeconds: Math.floor(positionSeconds) } });
  deleteHistory = (videoId: string) => invoke<void>('delete_history', { videoId });
  clearHistory = () => invoke<void>('clear_history');
  recordSearch = (query: string) => invoke<void>('record_search', { input: { query } });
  getCachedSearch = <T>(cacheKey: string) => invoke<T | null>('get_cached_search', { cacheKey });
  setCachedSearch = <T>(cacheKey: string, page: T) => invoke<void>('set_cached_search', {
    input: { cacheKey, payload: page },
  });
  toggleFollow = (input: FollowedChannel, followed: boolean) => invoke<void>('toggle_follow', { input, followed });
  setSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => invoke<void>('set_setting', { input: { key, value } });
  getStats = () => invoke<PrivacyStats>('get_stats');
  clearLocalData = () => invoke<void>('clear_local_data');
  getApiKeyStatus = () => invoke<ApiKeyStatus>('api_key_status');
  setApiKey = (apiKey: string) => invoke<void>('set_api_key', { input: { apiKey } });
  removeApiKey = () => invoke<void>('remove_api_key');
}
