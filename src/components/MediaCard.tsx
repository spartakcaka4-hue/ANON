import { ImageOff } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { HistoryEntry, Video } from '../domain/types';
import { formatDate, formatDuration, formatViews } from '../utils/format';
import { safeThumbnail } from '../utils/validation';

export function MediaCard({ video, compact = false }: { video: Video | HistoryEntry; compact?: boolean }) {
  const navigate = useNavigate();
  const [imageFailed, setImageFailed] = useState(false);
  const thumbnail = safeThumbnail(video.thumbnail);
  const progress = 'positionSeconds' in video && video.durationSeconds ? video.positionSeconds : 0;
  const meta = [formatViews(video.viewCount), formatDate(video.publishedAt)].filter(Boolean).join(' · ');

  return (
    <article className={compact ? 'media-card media-card--compact' : 'media-card'}>
      <button className="media-card-action" onClick={() => navigate(`/watch/${video.id}`, { state: { video } })} aria-label={`Watch ${video.title}`}>
        <span className="thumbnail-wrap">
          {!imageFailed && thumbnail ? (
            <img src={thumbnail} alt="" loading="lazy" onError={() => setImageFailed(true)} />
          ) : <span className="thumbnail-fallback"><ImageOff size={24} /><span>Thumbnail unavailable</span></span>}
          {video.durationSeconds ? <span className="duration">{formatDuration(video.durationSeconds)}</span> : null}
          {progress > 0 && video.durationSeconds ? <progress className="watch-progress" value={progress} max={video.durationSeconds} aria-label="Playback progress" /> : null}
        </span>
        <span className="media-title">{video.title}</span>
        <span className="media-channel">{video.channel}</span>
        {meta ? <span className="media-meta">{meta}</span> : null}
      </button>
    </article>
  );
}
