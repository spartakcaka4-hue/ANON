export type Theme = 'dark' | 'system';

export interface AppSettings {
  theme: Theme;
  autoplay: boolean;
  defaultPlaybackSpeed: number;
  historyEnabled: boolean;
  searchHistoryEnabled: boolean;
  reducedMotion: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  autoplay: false,
  defaultPlaybackSpeed: 1,
  historyEnabled: true,
  searchHistoryEnabled: true,
  reducedMotion: false,
};

export interface Video {
  id: string;
  title: string;
  channelId: string;
  channel: string;
  thumbnail: string;
  publishedAt: string | null;
  durationSeconds: number | null;
  viewCount: number | null;
  description: string | null;
  madeForKids?: boolean | null;
}

export interface HistoryEntry extends Video {
  watchedAt: number;
  positionSeconds: number;
}

export interface FollowedChannel {
  id: string;
  name: string;
  avatar: string | null;
  followedAt: number;
}

export interface SearchPage {
  items: Video[];
  nextPageToken: string | null;
}

export interface Channel {
  id: string;
  name: string;
  handle: string | null;
  description: string | null;
  avatar: string | null;
  banner: string | null;
  subscriberCount: number | null;
  videoCount: number | null;
  uploadsPlaylistId: string | null;
}

export interface ChannelSearchPage {
  items: Channel[];
  nextPageToken: string | null;
}

export interface ChannelUploadsPage {
  items: Video[];
  nextPageToken: string | null;
}

export interface BootstrapData {
  settings: Partial<AppSettings>;
  history: HistoryEntry[];
  follows: FollowedChannel[];
  startupNotice?: string | null;
}

export interface ApiKeyStatus {
  configured: boolean;
  persisted: boolean;
}

export interface PrivacyStats {
  historyCount: number;
  followCount: number;
  approximateBytes: number;
}
