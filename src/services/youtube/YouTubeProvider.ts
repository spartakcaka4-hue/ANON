import type { Channel, ChannelSearchPage, ChannelUploadsPage, SearchPage, Video } from '../../domain/types';

export interface YouTubeProvider {
  search(query: string, pageToken?: string): Promise<SearchPage>;
  searchChannels(query: string, pageToken?: string): Promise<ChannelSearchPage>;
  getChannel(channelId: string): Promise<Channel>;
  getChannelUploads(uploadsPlaylistId: string, pageToken?: string): Promise<ChannelUploadsPage>;
  getVideo(videoId: string): Promise<Video>;
}

export type YouTubeErrorKind =
  | 'configuration'
  | 'quota'
  | 'network'
  | 'not-found'
  | 'unavailable'
  | 'malformed'
  | 'unknown';

export class YouTubeError extends Error {
  constructor(public readonly kind: YouTubeErrorKind, message: string) {
    super(message);
    this.name = 'YouTubeError';
  }
}
