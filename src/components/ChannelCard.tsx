import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Channel } from '../domain/types';
import { formatCount } from '../utils/format';
import { safeThumbnail } from '../utils/validation';

export function ChannelCard({ channel }: { channel: Channel }) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
  const avatar = channel.avatar ? safeThumbnail(channel.avatar) : null;
  const subscribers = channel.subscriberCount === null
    ? 'Subscribers hidden'
    : formatCount(channel.subscriberCount, 'subscriber');
  const videos = formatCount(channel.videoCount, 'video');

  return (
    <article className="channel-card">
      <button
        className="channel-card-action"
        onClick={() => navigate(`/channel/${channel.id}`, { state: { channel } })}
        aria-label={`Open ${channel.name} channel`}
      >
        <span className="channel-card-avatar" aria-hidden="true">
          {!imageFailed && avatar ? (
            <img src={avatar} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          ) : <span className="channel-card-avatar-fallback"><ImageOff size={20} /></span>}
        </span>
        <span className="channel-card-copy">
          <span className="channel-card-name">{channel.name}</span>
          {channel.handle ? <span className="channel-card-handle">{channel.handle}</span> : null}
          <span className="channel-card-stats">{[subscribers, videos].filter(Boolean).join(' · ')}</span>
          <span className="channel-card-description">{channel.description || 'No channel description provided.'}</span>
        </span>
        <span className="channel-card-open" aria-hidden="true">View channel</span>
      </button>
    </article>
  );
}
