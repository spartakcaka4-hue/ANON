import { Clock3, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useApp } from '../app/useApp';
import { ConfirmDialog } from '../components/ConfirmDialog';
import { EmptyState } from '../components/EmptyState';
import { MediaCard } from '../components/MediaCard';

export default function HistoryPage() {
  const { history, deleteHistory, clearHistory } = useApp();
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  return (
    <div className="page">
      <div className="page-heading page-heading--actions">
        <div><h1>History</h1><p>{history.length} watches stored only on this device.</p></div>
        {history.length > 0 ? <button className="button button--danger-quiet" onClick={() => setConfirmClear(true)}><Trash2 size={16} /> Clear history</button> : null}
      </div>
      {history.length ? (
        <div className="history-list">
          {history.map((video) => (
            <div className="history-row" key={video.id}>
              <MediaCard video={video} />
              <button className="icon-button" aria-label={`Remove ${video.title} from history`} onClick={() => void deleteHistory(video.id)}><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      ) : <EmptyState icon={Clock3} title="No local history" body="Videos you open will appear here when watch history is enabled." />}
      {clearError ? <p className="danger-error" role="alert">{clearError}</p> : null}
      <ConfirmDialog open={confirmClear} title="Clear watch history?" body="This removes records from ANON’s active local history and playback positions. It does not affect YouTube or copies outside ANON, such as backups." confirmLabel="Clear history" dangerous onCancel={() => setConfirmClear(false)} onConfirm={() => {
        setClearError(null);
        void clearHistory().then(() => setConfirmClear(false)).catch(() => setClearError('ANON could not clear local watch history.'));
      }} />
    </div>
  );
}
