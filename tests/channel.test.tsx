import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ChannelCard } from '../src/components/ChannelCard';
import type { Channel } from '../src/domain/types';
import { mapChannel } from '../src/services/youtube/officialProvider';
import { safeThumbnail, searchCacheKey } from '../src/utils/validation';

const channel: Channel = {
  id: 'UC_x7h8fMq-W5AYjHZ9t6Q',
  name: 'Quiet Architecture',
  handle: '@quietarchitecture',
  description: 'Calm spaces and thoughtful buildings.',
  avatar: 'https://yt3.ggpht.com/channel-avatar',
  banner: null,
  subscriberCount: null,
  videoCount: 12,
  uploadsPlaylistId: 'UU_x7h8fMq-W5AYjHZ9t6Q',
};

describe('channel search and navigation', () => {
  it('maps hidden and missing metadata without inventing values', () => {
    const mapped = mapChannel({
      id: channel.id,
      snippet: { title: channel.name, customUrl: 'quietarchitecture', description: '' },
      statistics: { hiddenSubscriberCount: true, subscriberCount: '999', videoCount: '12' },
      contentDetails: { relatedPlaylists: { uploads: channel.uploadsPlaylistId ?? undefined } },
      brandingSettings: {},
    });

    expect(mapped.handle).toBe('@quietarchitecture');
    expect(mapped.subscriberCount).toBeNull();
    expect(mapped.description).toBeNull();
    expect(mapped.banner).toBeNull();
    expect(mapped.videoCount).toBe(12);
  });

  it('separates video and channel cache entries and allows official channel images', () => {
    expect(searchCacheKey('  Quiet   Architecture ', 'channels')).toBe('search::channels::quiet architecture::first');
    expect(searchCacheKey('Quiet Architecture', 'videos')).not.toBe(searchCacheKey('Quiet Architecture', 'channels'));
    expect(safeThumbnail('https://yt3.googleusercontent.com/banner-image')).toContain('yt3.googleusercontent.com');
  });

  it('opens the native channel route instead of YouTube', () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<ChannelCard channel={channel} />} />
          <Route path="/channel/:channelId" element={<p>Native channel opened</p>} />
        </Routes>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: `Open ${channel.name} channel` }));
    expect(screen.getByText('Native channel opened')).toBeInTheDocument();
  });
});
