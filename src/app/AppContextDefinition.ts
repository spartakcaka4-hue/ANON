import { createContext } from 'react';
import type { AppSettings, FollowedChannel, HistoryEntry, Video } from '../domain/types';

export interface AppContextValue {
  ready: boolean;
  storageError: string | null;
  settings: AppSettings;
  history: HistoryEntry[];
  follows: FollowedChannel[];
  recordWatch(video: Video): Promise<void>;
  updateProgress(videoId: string, seconds: number): Promise<void>;
  deleteHistory(videoId: string): Promise<void>;
  clearHistory(): Promise<void>;
  toggleFollow(channel: Omit<FollowedChannel, 'followedAt'>): Promise<void>;
  updateSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void>;
  clearLocalData(): Promise<void>;
}

export const AppContext = createContext<AppContextValue | null>(null);
