import { Radio, UsersRound } from 'lucide-react';
import { useApp } from '../app/useApp';
import { EmptyState } from '../components/EmptyState';

export default function FollowingPage() {
  const { follows, toggleFollow } = useApp();
  return (
    <div className="page">
      <div className="page-heading"><h1>Following</h1><p>Local-only channel follows. This does not read or change YouTube subscriptions.</p></div>
      {follows.length ? (
        <div className="following-list">
          {follows.map((channel) => (
            <article key={channel.id}>
              <span className="channel-avatar">{channel.name.slice(0, 1).toLocaleUpperCase()}</span>
              <div><h2>{channel.name}</h2><p>Followed locally</p></div>
              <button className="button button--secondary" onClick={() => void toggleFollow(channel)}>Unfollow</button>
            </article>
          ))}
        </div>
      ) : <EmptyState icon={UsersRound} title="No local follows yet" body="Open a video and follow its channel. ANON will remember it only on this device." action={<div className="inline-note"><Radio size={15} /> No synced subscription feed in v1</div>} />}
    </div>
  );
}
