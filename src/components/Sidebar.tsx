import { Clock3, Home, Search, Settings, UsersRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { useApp } from '../app/useApp';
import { Brand } from './Brand';

const items = [
  { to: '/', label: 'Home', icon: Home },
  { to: '/search', label: 'Search', icon: Search },
  { to: '/history', label: 'History', icon: Clock3 },
  { to: '/following', label: 'Following', icon: UsersRound },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Sidebar() {
  const { history, follows } = useApp();
  return (
    <aside className="sidebar">
      <Brand />
      <nav aria-label="Primary">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink key={to} to={to} end={to === '/'}>
            <Icon aria-hidden="true" size={20} strokeWidth={1.8} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
      <div className="privacy-rail" aria-label="Privacy status">
        <p><span className="status-dot" /> Telemetry off</p>
        <p><span className="status-dot" /> No ANON account</p>
        <p><span className="status-dot" /> {history.length} local watches</p>
        <p className="rail-follows">{follows.length} local follows</p>
      </div>
    </aside>
  );
}
