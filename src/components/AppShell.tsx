import { AlertTriangle } from 'lucide-react';
import { Outlet, useLocation } from 'react-router-dom';
import { useApp } from '../app/useApp';
import { SearchBox } from './SearchBox';
import { Sidebar } from './Sidebar';

export function AppShell() {
  const { ready, storageError } = useApp();
  const location = useLocation();
  const isWatch = location.pathname.startsWith('/watch/');
  return (
    <div className="app-shell">
      <Sidebar />
      <main className={isWatch ? 'app-main app-main--watch' : 'app-main'}>
        {!isWatch ? <header className="topbar"><SearchBox /></header> : null}
        {storageError ? <div className="global-alert"><AlertTriangle size={18} />{storageError}</div> : null}
        {!ready ? <div className="page-loader" aria-label="Opening local data"><span /><span /><span /></div> : <Outlet />}
      </main>
    </div>
  );
}
