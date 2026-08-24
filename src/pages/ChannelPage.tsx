import { AlertCircle, ImageOff, LoaderCircle, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useApp } from '../app/useApp';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import type { Channel, Video } from '../domain/types';
import { youtubeProvider } from '../services/youtube/officialProvider';
import { formatCount } from '../utils/format';
import { isChannelId, safeThumbnail } from '../utils/validation';

interface ChannelRouteState { channel?: Channel }

export default function ChannelPage() {
  const { channelId = '' } = useParams();
  const location = useLocation();
  const { follows, toggleFollow } = useApp();
  const routeChannel = useMemo(() => {
    const candidate = (location.state as ChannelRouteState | null)?.channel;
    return candidate?.id === channelId ? candidate : null;
  }, [channelId, location.state]);
  const [channel, setChannel] = useState<Channel | null>(routeChannel);
  const [videos, setVideos] = useState<Video[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loadingChannel, setLoadingChannel] = useState(!routeChannel);
  const [loadingUploads, setLoadingUploads] = useState(false);
  const [channelError, setChannelError] = useState<string | null>(null);
  const [uploadsError, setUploadsError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [bannerFailed, setBannerFailed] = useState(false);
  const [avatarFailed, setAvatarFailed] = useState(false);
  const requestId = useRef(0);

  const loadUploads = useCallback(async (resolved: Channel, pageToken?: string) => {
    if (!resolved.uploadsPlaylistId) return;
    const currentRequest = ++requestId.current;
    setLoadingUploads(true);
    setUploadsError(null);
    try {
      const page = await youtubeProvider.getChannelUploads(resolved.uploadsPlaylistId, pageToken);
      if (currentRequest !== requestId.current) return;
      setVideos((current) => pageToken
        ? [...current, ...page.items.filter((video) => !current.some((item) => item.id === video.id))]
        : page.items);
      setNextToken(page.nextPageToken);
    } catch (reason) {
      if (currentRequest === requestId.current) {
        setUploadsError(reason instanceof Error ? reason.message : 'Channel uploads could not be loaded.');
      }
    } finally {
      if (currentRequest === requestId.current) setLoadingUploads(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    requestId.current += 1;
    setChannel(routeChannel);
    setVideos([]);
    setNextToken(null);
    setChannelError(null);
    setUploadsError(null);
    setBannerFailed(false);
    setAvatarFailed(false);

    if (!isChannelId(channelId)) {
      setLoadingChannel(false);
      setChannelError('This channel address is invalid.');
      return () => { active = false; requestId.current += 1; };
    }

    const load = async () => {
      setLoadingChannel(!routeChannel);
      try {
        const resolved = routeChannel ?? await youtubeProvider.getChannel(channelId);
        if (!active) return;
        setChannel(resolved);
        setLoadingChannel(false);
        await loadUploads(resolved);
      } catch (reason) {
        if (!active) return;
        setLoadingChannel(false);
        setChannelError(reason instanceof Error ? reason.message : 'This channel could not be loaded.');
      }
    };
    void load();
    return () => { active = false; requestId.current += 1; };
  }, [channelId, loadUploads, routeChannel]);

  if (loadingChannel && !channel) {
    return <div className="page channel-page"><div className="channel-page-loading"><LoaderCircle className="spin" size={28} /><p>Loading channel</p></div></div>;
  }

  if (channelError || !channel) {
    return (
      <div className="page channel-page">
        <EmptyState icon={AlertCircle} title="Channel unavailable" body={channelError ?? 'This channel is missing or unavailable.'} />
      </div>
    );
  }

  const banner = channel.banner ? safeThumbnail(channel.banner) : null;
  const avatar = channel.avatar ? safeThumbnail(channel.avatar) : null;
  const followed = follows.some((item) => item.id === channel.id);
  const subscribers = channel.subscriberCount === null
    ? 'Subscribers hidden'
    : formatCount(channel.subscriberCount, 'subscriber');
  const videoCount = formatCount(channel.videoCount, 'video');

  return (
    <div className="page channel-page">
      <section className="channel-hero">
        <div className="channel-banner">
          {!bannerFailed && banner ? <img src={banner} alt="" onError={() => setBannerFailed(true)} /> : <span />}
        </div>
        <div className="channel-identity">
          <div className="channel-profile-avatar" aria-hidden="true">
            {!avatarFailed && avatar ? <img src={avatar} alt="" onError={() => setAvatarFailed(true)} /> : <ImageOff size={28} />}
          </div>
          <div className="channel-identity-copy">
            <h1>{channel.name}</h1>
            <p className="channel-identity-meta">{[channel.handle, subscribers, videoCount].filter(Boolean).join(' · ')}</p>
            <p className="channel-description">{channel.description || 'No channel description provided.'}</p>
          </div>
          <button className={followed ? 'button button--secondary' : 'button'} onClick={() => {
            setFollowError(null);
            void toggleFollow({ id: channel.id, name: channel.name, avatar: channel.avatar }).catch(() => setFollowError('ANON could not update this local follow.'));
          }}>{followed ? 'Following locally' : 'Follow locally'}</button>
        </div>
        {followError ? <p className="channel-follow-error" role="alert">{followError}</p> : null}
      </section>

      <section className="channel-uploads" aria-labelledby="channel-uploads-heading">
        <div className="section-heading"><h2 id="channel-uploads-heading">Uploads</h2><span>From the channel’s official uploads playlist</span></div>
        {uploadsError ? (
          <div className="error-state" role="alert">
            <AlertCircle size={24} /><div><h2>Uploads unavailable</h2><p>{uploadsError}</p></div>
            <button className="button button--secondary" onClick={() => void loadUploads(channel)}>Retry</button>
          </div>
        ) : null}
        {videos.length ? <div className="media-grid">{videos.map((video) => <MediaCard key={video.id} video={video} />)}</div> : null}
        {loadingUploads && videos.length === 0 ? <div className="skeleton-grid" aria-label="Loading channel uploads">{Array.from({ length: 8 }, (_, index) => <div className="skeleton-card" key={index}><span /><i /><i /></div>)}</div> : null}
        {!loadingUploads && !uploadsError && videos.length === 0 ? (
          <EmptyState icon={UsersRound} title="No uploads available" body={channel.uploadsPlaylistId ? 'This channel has no public uploads.' : 'YouTube did not provide an uploads playlist for this channel.'} />
        ) : null}
        {nextToken ? <div className="load-more"><button className="button button--secondary" disabled={loadingUploads} onClick={() => void loadUploads(channel, nextToken)}>{loadingUploads ? <><LoaderCircle className="spin" size={16} /> Loading</> : 'Load more uploads'}</button></div> : null}
      </section>
    </div>
  );
}
