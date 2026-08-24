import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import './styles.css';

const root = document.getElementById('root');
if (!root) throw new Error('ANON root element is missing');
createRoot(root).render(<StrictMode><AppErrorBoundary><App /></AppErrorBoundary></StrictMode>);
