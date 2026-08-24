import { describe, expect, it } from 'vitest';
import { BrowserRepository } from '../src/storage/browserRepository';
import type { ChannelSearchPage, SearchPage, Video } from '../src/domain/types';

const video: Video = {
  id: 'dQw4w9WgXcQ', title: 'Test video', channelId: 'UC_test_channel', channel: 'Test channel',
  thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg', publishedAt: null,
  durationSeconds: 180, viewCount: 10, description: null,
};

describe('browser development repository', () => {
  it('persists history, progress, settings, and follows across instances', async () => {
    const first = new BrowserRepository();
    await first.recordWatch(video);
    await first.updateProgress(video.id, 42.8);
    await first.setSetting('autoplay', true);
    await first.toggleFollow({ id: video.channelId, name: video.channel, avatar: null, followedAt: 1 }, true);

    const reopened = await new BrowserRepository().initialize();
    expect(reopened.history).toHaveLength(1);
    expect(reopened.history[0].positionSeconds).toBe(42);
    expect(reopened.settings.autoplay).toBe(true);
    expect(reopened.follows[0].name).toBe('Test channel');
  });

  it('expires cached search results and clears all active data', async () => {
    const repository = new BrowserRepository();
    const page: SearchPage = { items: [video], nextPageToken: null };
    await repository.setCachedSearch('test::first', page);
    expect(await repository.getCachedSearch('test::first')).toEqual(page);
    await repository.clearLocalData();
    expect((await repository.initialize()).history).toHaveLength(0);
  });

  it('stores typed channel-search pages in the same local cache without storing secrets', async () => {
    const repository = new BrowserRepository();
    const page: ChannelSearchPage = {
      items: [{
        id: 'UC_x7h8fMq-W5AYjHZ9t6Q', name: 'Quiet Architecture', handle: null,
        description: null, avatar: null, banner: null, subscriberCount: null,
        videoCount: 0, uploadsPlaylistId: 'UU_x7h8fMq-W5AYjHZ9t6Q',
      }],
      nextPageToken: null,
    };
    await repository.setCachedSearch('search::channels::quiet::first', page);
    expect(await repository.getCachedSearch<ChannelSearchPage>('search::channels::quiet::first')).toEqual(page);
    expect(localStorage.getItem('anon:local-data:v1')).not.toContain('YOUTUBE_API_KEY');
  });

  it('recovers from malformed persisted shapes without trusting browser storage', async () => {
    localStorage.setItem('anon:local-data:v1', JSON.stringify({
      history: 'not-an-array',
      follows: null,
      settings: [],
      cache: { broken: { value: {}, expiresAt: 'never' } },
    }));

    const bootstrap = await new BrowserRepository().initialize();
    expect(bootstrap.history).toEqual([]);
    expect(bootstrap.follows).toEqual([]);
    expect(bootstrap.settings).toEqual({});
    expect(await new BrowserRepository().getCachedSearch('broken')).toBeNull();
  });
});
