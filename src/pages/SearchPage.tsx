import { AlertCircle, LoaderCircle, Search as SearchIcon, UsersRound } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../app/useApp';
import { ChannelCard } from '../components/ChannelCard';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';
import type { Channel, ChannelSearchPage, SearchPage, Video } from '../domain/types';
import { youtubeProvider } from '../services/youtube/officialProvider';
import { localRepository } from '../storage';
import { normalizeQuery, searchCacheKey } from '../utils/validation';

type SearchMode = 'videos' | 'channels';

export default function SearchPage() {
  const [params, setParams] = useSearchParams();
  const { settings } = useApp();
  const query = normalizeQuery(params.get('q') ?? '');
  const mode: SearchMode = params.get('type') === 'channels' ? 'channels' : 'videos';
  const [videos, setVideos] = useState<Video[]>([]);
  const [channels, setChannels] = useState<Channel[]>([]);
  const [nextToken, setNextToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheNotice, setCacheNotice] = useState(false);
  const requestId = useRef(0);

  const load = useCallback(async (pageToken?: string) => {
    if (!query) return;
    const currentRequest = ++requestId.current;
    setLoading(true);
    setError(null);
    const cacheKey = searchCacheKey(query, mode, pageToken);
    try {
      if (mode === 'channels') {
        const cached = await localRepository.getCachedSearch<ChannelSearchPage>(cacheKey);
        const page = cached ?? await youtubeProvider.searchChannels(query, pageToken);
        if (currentRequest !== requestId.current) return;
        if (!cached) await localRepository.setCachedSearch(cacheKey, page);
        setCacheNotice(Boolean(cached));
        setChannels((current) => pageToken
          ? [...current, ...page.items.filter((channel) => !current.some((item) => item.id === channel.id))]
          : page.items);
        setNextToken(page.nextPageToken);
      } else {
        const cached = await localRepository.getCachedSearch<SearchPage>(cacheKey);
        const page = cached ?? await youtubeProvider.search(query, pageToken);
        if (currentRequest !== requestId.current) return;
        if (!cached) await localRepository.setCachedSearch(cacheKey, page);
        setCacheNotice(Boolean(cached));
        setVideos((current) => pageToken
          ? [...current, ...page.items.filter((video) => !current.some((item) => item.id === video.id))]
          : page.items);
        setNextToken(page.nextPageToken);
      }
      if (!pageToken && settings.searchHistoryEnabled) await localRepository.recordSearch(query);
    } catch (reason) {
      if (currentRequest === requestId.current) setError(reason instanceof Error ? reason.message : 'Search failed. Try again.');
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [mode, query, settings.searchHistoryEnabled]);

  useEffect(() => {
    setVideos([]);
    setChannels([]);
    setNextToken(null);
    setCacheNotice(false);
    void load();
    return () => { requestId.current += 1; };
  }, [load]);

  function selectMode(nextMode: SearchMode) {
    const next = new URLSearchParams(params);
    if (nextMode === 'channels') next.set('type', 'channels');
    else next.delete('type');
    setParams(next);
  }

  const tabs = (
    <div className="search-tabs" role="tablist" aria-label="Search result type">
      <button role="tab" aria-selected={mode === 'videos'} onClick={() => selectMode('videos')}>Videos</button>
      <button role="tab" aria-selected={mode === 'channels'} onClick={() => selectMode('channels')}>Channels</button>
    </div>
  );

  if (!query) {
    return (
      <div className="page">
        <div className="page-heading"><h1>Search</h1><p>Requests go directly to YouTube only when you submit.</p></div>
        {tabs}
        <EmptyState icon={mode === 'channels' ? UsersRound : SearchIcon} title={mode === 'channels' ? 'Which channel are you looking for?' : 'What do you want to watch?'} body="Type above and press Enter. ANON never sends a request for each keystroke." />
      </div>
    );
  }

  const itemCount = mode === 'channels' ? channels.length : videos.length;
  return (
    <div className="page search-page">
      <div className="page-heading">
        <h1>Results for “{query}”</h1>
        <p>{cacheNotice ? 'Loaded from this device’s recent cache.' : 'Official YouTube results. No ANON profile involved.'}</p>
      </div>
      {tabs}
      {error ? (
        <div className="error-state" role="alert">
          <AlertCircle size={24} /><div><h2>{mode === 'channels' ? 'Channel search unavailable' : 'Search unavailable'}</h2><p>{error}</p></div>
          <button className="button button--secondary" onClick={() => void load()}>Retry</button>
        </div>
      ) : null}
      {mode === 'videos' && videos.length > 0 ? <div className="media-grid search-grid">{videos.map((video) => <MediaCard key={video.id} video={video} />)}</div> : null}
      {mode === 'channels' && channels.length > 0 ? <div className="channel-results">{channels.map((channel) => <ChannelCard key={channel.id} channel={channel} />)}</div> : null}
      {loading && itemCount === 0 ? <div className={mode === 'channels' ? 'channel-skeletons' : 'skeleton-grid'} aria-label={`Loading ${mode}`}>{Array.from({ length: mode === 'channels' ? 6 : 8 }, (_, index) => <div className={mode === 'channels' ? 'channel-skeleton' : 'skeleton-card'} key={index}><span /><i /><i /></div>)}</div> : null}
      {!loading && !error && itemCount === 0 ? <EmptyState icon={mode === 'channels' ? UsersRound : SearchIcon} title={`No ${mode} found`} body="Try a broader search or different wording." /> : null}
      {nextToken ? <div className="load-more"><button className="button button--secondary" disabled={loading} onClick={() => void load(nextToken)}>{loading ? <><LoaderCircle className="spin" size={16} /> Loading</> : `Load more ${mode}`}</button></div> : null}
    </div>
  );
}
