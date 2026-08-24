import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { AppShell } from '../components/AppShell';
import { AppProvider } from './AppContext';

const HomePage = lazy(() => import('../pages/HomePage'));
const SearchPage = lazy(() => import('../pages/SearchPage'));
const HistoryPage = lazy(() => import('../pages/HistoryPage'));
const FollowingPage = lazy(() => import('../pages/FollowingPage'));
const SettingsPage = lazy(() => import('../pages/SettingsPage'));
const WatchPage = lazy(() => import('../pages/WatchPage'));
const ChannelPage = lazy(() => import('../pages/ChannelPage'));
const NotFoundPage = lazy(() => import('../pages/NotFoundPage'));

const fallback = <div className="page-loader" aria-label="Loading page"><span /><span /><span /></div>;
const route = (component: React.ReactNode) => <Suspense fallback={fallback}>{component}</Suspense>;

const router = createBrowserRouter([{
  element: <AppShell />,
  children: [
    { path: '/', element: route(<HomePage />) },
    { path: '/search', element: route(<SearchPage />) },
    { path: '/history', element: route(<HistoryPage />) },
    { path: '/following', element: route(<FollowingPage />) },
    { path: '/settings', element: route(<SettingsPage />) },
    { path: '/watch/:videoId', element: route(<WatchPage />) },
    { path: '/channel/:channelId', element: route(<ChannelPage />) },
    { path: '*', element: route(<NotFoundPage />) },
  ],
}]);

export function App() {
  return <AppProvider><RouterProvider router={router} /></AppProvider>;
}
