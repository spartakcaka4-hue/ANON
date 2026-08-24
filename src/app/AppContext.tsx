import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { DEFAULT_SETTINGS, type AppSettings, type FollowedChannel, type HistoryEntry, type Video } from '../domain/types';
import { localRepository } from '../storage';

import { AppContext } from './AppContextDefinition';

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [follows, setFollows] = useState<FollowedChannel[]>([]);

  useEffect(() => {
    let active = true;
    localRepository.initialize()
      .then((data) => {
        if (!active) return;
        setSettings({ ...DEFAULT_SETTINGS, ...data.settings });
        setHistory(data.history);
        setFollows(data.follows);
        setStorageError(data.startupNotice ?? null);
      })
      .catch(() => active && setStorageError('ANON could not open its local data. Restart the app; your data has not been sent anywhere.'))
      .finally(() => active && setReady(true));
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.reducedMotion = settings.reducedMotion ? 'true' : 'false';
  }, [settings.reducedMotion]);

  const recordWatch = useCallback(async (video: Video) => {
    if (!settings.historyEnabled) return;
    await localRepository.recordWatch(video);
    setHistory((current) => [{ ...video, watchedAt: Math.floor(Date.now() / 1000), positionSeconds: current.find((item) => item.id === video.id)?.positionSeconds ?? 0 }, ...current.filter((item) => item.id !== video.id)]);
  }, [settings.historyEnabled]);

  const updateProgress = useCallback(async (videoId: string, seconds: number) => {
    if (!settings.historyEnabled) return;
    await localRepository.updateProgress(videoId, seconds);
    setHistory((current) => current.map((item) => item.id === videoId ? { ...item, positionSeconds: Math.floor(seconds) } : item));
  }, [settings.historyEnabled]);

  const deleteHistory = useCallback(async (videoId: string) => {
    await localRepository.deleteHistory(videoId);
    setHistory((current) => current.filter((item) => item.id !== videoId));
  }, []);

  const clearHistory = useCallback(async () => {
    await localRepository.clearHistory();
    setHistory([]);
  }, []);

  const toggleFollow = useCallback(async (channel: Omit<FollowedChannel, 'followedAt'>) => {
    const followed = !follows.some((item) => item.id === channel.id);
    const record = { ...channel, followedAt: Math.floor(Date.now() / 1000) };
    await localRepository.toggleFollow(record, followed);
    setFollows((current) => followed ? [record, ...current.filter((item) => item.id !== record.id)] : current.filter((item) => item.id !== record.id));
  }, [follows]);

  const updateSetting = useCallback(async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await localRepository.setSetting(key, value);
    setSettings((current) => ({ ...current, [key]: value }));
  }, []);

  const clearLocalData = useCallback(async () => {
    await localRepository.clearLocalData();
    setSettings(DEFAULT_SETTINGS);
    setHistory([]);
    setFollows([]);
  }, []);

  const value = useMemo(() => ({
    ready, storageError, settings, history, follows, recordWatch, updateProgress,
    deleteHistory, clearHistory, toggleFollow, updateSetting, clearLocalData,
  }), [ready, storageError, settings, history, follows, recordWatch, updateProgress, deleteHistory, clearHistory, toggleFollow, updateSetting, clearLocalData]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
