import { AlertCircle, ArrowLeft, Check, Plus, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import YouTube from 'react-youtube';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useApp } from '../app/useApp';
import type { Video } from '../domain/types';
import { youtubeProvider } from '../services/youtube/officialProvider';
import { formatDate, formatViews } from '../utils/format';
import { isVideoId } from '../utils/validation';

interface PlayerLike {
  playVideo(): void;
  pauseVideo(): void;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  getCurrentTime(): number;
  getPlayerState(): number;
  getVolume(): number;
  setVolume(volume: number): void;
  setPlaybackRate(rate: number): void;
  getIframe(): HTMLIFrameElement;
}

export default function WatchPage() {
  const { videoId = '' } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { settings, follows, recordWatch, updateProgress, toggleFollow } = useApp();
  const stateVideo = (location.state as { video?: Video } | null)?.video;
  const [video, setVideo] = useState<Video | null>(stateVideo?.id === videoId ? stateVideo : null);
  const [loading, setLoading] = useState(!video);
  const [error, setError] = useState<string | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const player = useRef<PlayerLike | null>(null);
  const historyRecorded = useRef(false);
  const historyWritePending = useRef(false);
  const followed = video ? follows.some((item) => item.id === video.channelId) : false;

  useEffect(() => {
    if (video || !isVideoId(videoId)) {
      if (!isVideoId(videoId)) { setError('This video address is not valid.'); setLoading(false); }
      return;
    }
    let active = true;
    youtubeProvider.getVideo(videoId)
      .then((item) => active && setVideo(item))
      .catch((reason) => active && setError(reason instanceof Error ? reason.message : 'This video is unavailable.'))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [video, videoId]);

  const saveProgress = useCallback(() => {
    const current = player.current?.getCurrentTime();
    if (video && historyRecorded.current && current && Number.isFinite(current)) {
      void updateProgress(video.id, current).catch(() => undefined);
    }
  }, [video, updateProgress]);

  useEffect(() => {
    const interval = window.setInterval(saveProgress, 15000);
    return () => { window.clearInterval(interval); saveProgress(); };
  }, [saveProgress]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (!player.current || event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLTextAreaElement) return;
      const current = player.current;
      if (event.code === 'Space') {
        event.preventDefault();
        if (current.getPlayerState() === 1) current.pauseVideo();
        else current.playVideo();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault(); current.seekTo(Math.max(0, current.getCurrentTime() - 5), true);
      } else if (event.key === 'ArrowRight') {
        event.preventDefault(); current.seekTo(current.getCurrentTime() + 5, true);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault(); current.setVolume(Math.min(100, current.getVolume() + 5));
      } else if (event.key === 'ArrowDown') {
        event.preventDefault(); current.setVolume(Math.max(0, current.getVolume() - 5));
      } else if (event.key.toLocaleLowerCase() === 'f') {
        event.preventDefault(); void current.getIframe().requestFullscreen();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (loading) return <div className="watch-loading"><span /><p>Preparing the official player…</p></div>;
  if (error || !video) return <div className="watch-error"><AlertCircle size={28} /><h1>Video unavailable</h1><p>{error ?? 'ANON could not load this video.'}</p><button className="button" onClick={() => navigate(-1)}>Go back</button></div>;

  const meta = [formatViews(video.viewCount), formatDate(video.publishedAt)].filter(Boolean).join(' · ');
  return (
    <div className="watch-page">
      <header className="watch-header">
        <button className="back-button" onClick={() => navigate(-1)}><ArrowLeft size={19} /> Back</button>
        <div className="watch-brand">ANON <span>PLAYER</span></div>
        <div className="watch-privacy"><ShieldCheck size={16} /> Privacy-enhanced embed</div>
      </header>
      <div className="player-stage">
        <YouTube
          videoId={video.id}
          title={video.title}
          className="youtube-frame-wrap"
          iframeClassName="youtube-frame"
          opts={{
            host: 'https://www.youtube-nocookie.com',
            width: '100%', height: '100%',
            playerVars: {
              autoplay: settings.autoplay ? 1 : 0, controls: 1, enablejsapi: 1,
              fs: 1, playsinline: 1, rel: 0, origin: window.location.origin,
            },
          }}
          onReady={(event) => {
            player.current = event.target as PlayerLike;
            player.current.getIframe().referrerPolicy = 'strict-origin-when-cross-origin';
            try { player.current.setPlaybackRate(settings.defaultPlaybackSpeed); } catch { /* Player decides available rates. */ }
          }}
          onError={(event) => {
            const messages: Record<number, string> = {
              2: 'The video address is invalid.', 5: 'The YouTube player could not start.',
              100: 'This video is private, deleted, or unavailable.',
              101: 'The owner does not allow this video to be embedded.',
              150: 'The owner does not allow this video to be embedded.',
              153: 'YouTube rejected this desktop player identity. See the native player compatibility note in the README.',
            };
            setPlayerError(messages[event.data] ?? 'The YouTube player reported an error.');
          }}
          onStateChange={(event) => {
            if (event.data === 1 && !historyRecorded.current && !historyWritePending.current) {
              historyWritePending.current = true;
              void recordWatch(video)
                .then(() => { historyRecorded.current = true; })
                .catch(() => setPlayerError('Playback started, but ANON could not update local history.'))
                .finally(() => { historyWritePending.current = false; });
            }
            if (event.data === 0 || event.data === 2) saveProgress();
          }}
        />
      </div>
      {playerError ? <div className="player-error" role="alert"><AlertCircle size={18} />{playerError}</div> : null}
      <section className="watch-details">
        <div className="watch-title-row"><div><h1>{video.title}</h1>{meta ? <p>{meta}</p> : null}</div></div>
        <div className="channel-row">
          <span className="channel-avatar channel-avatar--large">{video.channel.slice(0, 1).toLocaleUpperCase()}</span>
          <div><h2>{video.channel}</h2><p>Local following does not affect YouTube subscriptions.</p></div>
          <button className={followed ? 'button button--secondary' : 'button'} onClick={() => void toggleFollow({ id: video.channelId, name: video.channel, avatar: null })}>
            {followed ? <><Check size={16} /> Following locally</> : <><Plus size={16} /> Follow locally</>}
          </button>
        </div>
        {video.description ? <details className="description"><summary>Description</summary><p>{video.description}</p></details> : null}
        <p className="player-disclosure">The official YouTube player may show ads. Loading and using it sends the video ID, network information, and player context directly to Google/YouTube. ANON does not receive a copy.</p>
      </section>
    </div>
  );
}
