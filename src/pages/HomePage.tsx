import { ArrowRight, Search } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/useApp';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';

const prompts = ['Independent documentaries', 'Ambient architecture', 'Deep focus music', 'Live studio sessions'];

export default function HomePage() {
  const navigate = useNavigate();
  const { history } = useApp();
  const continueWatching = history.filter((item) => item.positionSeconds > 0 && (!item.durationSeconds || item.positionSeconds < item.durationSeconds * 0.92)).slice(0, 5);

  return (
    <div className="page home-page">
      <section className="home-intro">
        <h1>A quieter way to watch</h1>
      </section>

      {continueWatching.length > 0 ? (
        <section className="media-section">
          <div className="section-heading"><h2>Continue watching</h2><span>{continueWatching.length} local</span></div>
          <div className="media-rail">{continueWatching.map((video) => <MediaCard key={video.id} video={video} compact />)}</div>
        </section>
      ) : null}

      {history.length > 0 ? (
        <section className="media-section">
          <div className="section-heading"><h2>Recently watched</h2><button onClick={() => navigate('/history')}>View history <ArrowRight size={16} /></button></div>
          <div className="media-grid">{history.slice(0, 8).map((video) => <MediaCard key={video.id} video={video} />)}</div>
        </section>
      ) : (
        <EmptyState
          icon={Search}
          title="Your home starts locally"
          body="Watch history will appear here only after you choose something. Try a search to begin."
          action={<button className="button" onClick={() => navigate('/search')}>Open search</button>}
        />
      )}

      <section className="prompt-section">
        <h2>Start with a thought</h2>
        <div className="prompt-list">
          {prompts.map((prompt, index) => (
            <button key={prompt} onClick={() => navigate(`/search?q=${encodeURIComponent(prompt)}`)}>
              <span>0{index + 1}</span>{prompt}<ArrowRight size={18} />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
