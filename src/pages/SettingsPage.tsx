import { Database, EyeOff, HardDrive, KeyRound, ShieldCheck, UserRoundX, Wifi } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useApp } from '../app/useApp';
import { ConfirmDialog } from '../components/ConfirmDialog';
import type { ApiKeyStatus, PrivacyStats } from '../domain/types';
import { localRepository } from '../storage';
import { formatBytes } from '../utils/format';

function Toggle({ checked, onChange, label }: { checked: boolean; onChange(value: boolean): void; label: string }) {
  return <button role="switch" aria-checked={checked} aria-label={label} className="toggle" onClick={() => onChange(!checked)}><span /></button>;
}

export default function SettingsPage() {
  const { settings, updateSetting, clearLocalData } = useApp();
  const [stats, setStats] = useState<PrivacyStats>({ historyCount: 0, followCount: 0, approximateBytes: 0 });
  const [confirmClear, setConfirmClear] = useState(false);
  const [clearError, setClearError] = useState<string | null>(null);
  const [clearing, setClearing] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [apiKeyStatus, setApiKeyStatus] = useState<ApiKeyStatus>({ configured: false, persisted: false });
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const [apiKeyError, setApiKeyError] = useState<string | null>(null);
  const [savingApiKey, setSavingApiKey] = useState(false);
  const [confirmRemoveKey, setConfirmRemoveKey] = useState(false);
  const nativeRuntime = '__TAURI_INTERNALS__' in window;
  useEffect(() => {
    let active = true;
    void Promise.all([localRepository.getStats(), localRepository.getApiKeyStatus()])
      .then(([nextStats, nextKeyStatus]) => {
        if (!active) return;
        setStats(nextStats);
        setApiKeyStatus(nextKeyStatus);
      });
    return () => { active = false; };
  }, []);

  return (
    <div className="page settings-page">
      <div className="page-heading"><h1>Settings</h1><p>Quiet defaults, stored locally.</p></div>

      <section className="settings-section">
        <h2>Appearance</h2>
        <div className="setting-row"><div><h3>Theme</h3><p>ANON Alpha 0.1.0 uses its low-glare dark interface. Additional themes are deferred.</p></div><span className="managed-value">Dark</span></div>
        <div className="setting-row"><div><h3>Reduced motion</h3><p>Remove nonessential transitions and loading motion.</p></div><Toggle label="Reduced motion" checked={settings.reducedMotion} onChange={(value) => void updateSetting('reducedMotion', value)} /></div>
      </section>

      <section className="settings-section">
        <h2>Playback</h2>
        <div className="setting-row"><div><h3>Autoplay</h3><p>Start the official player when a watch page opens.</p></div><Toggle label="Autoplay" checked={settings.autoplay} onChange={(value) => void updateSetting('autoplay', value)} /></div>
        <label className="setting-row"><div><h3>Default playback speed</h3><p>Applied when the official player reports the rate is available.</p></div><select value={settings.defaultPlaybackSpeed} onChange={(event) => void updateSetting('defaultPlaybackSpeed', Number(event.target.value))}>{[0.5, 0.75, 1, 1.25, 1.5, 2].map((rate) => <option key={rate} value={rate}>{rate}×</option>)}</select></label>
        <div className="setting-row"><div><h3>Video quality</h3><p>YouTube’s player manages quality. Its settings menu remains available.</p></div><span className="managed-value">Managed by YouTube</span></div>
      </section>

      <section className="settings-section">
        <h2>Local data</h2>
        <div className="setting-row"><div><h3>Watch history</h3><p>Record videos and playback position in the local database.</p></div><Toggle label="Watch history" checked={settings.historyEnabled} onChange={(value) => void updateSetting('historyEnabled', value)} /></div>
        <div className="setting-row"><div><h3>Search history</h3><p>Remember submitted queries locally. Search-result cache remains separate.</p></div><Toggle label="Search history" checked={settings.searchHistoryEnabled} onChange={(value) => void updateSetting('searchHistoryEnabled', value)} /></div>
      </section>

      <section className="settings-section youtube-access">
        <div><KeyRound size={20} /><div><h2>YouTube access</h2><p>Bring your own YouTube Data API v3 key. ANON protects saved keys with Windows DPAPI for your Windows account, keeps them outside its database, and sends them only to Google’s YouTube Data API when you request YouTube data.</p></div></div>
        <div className="api-key-status"><span className={apiKeyStatus.configured ? 'status-dot' : 'status-dot status-dot--off'} />{apiKeyStatus.configured ? (apiKeyStatus.persisted ? 'Key saved for this Windows account' : 'Environment key active for this session') : 'No API key configured'}</div>
        <form className="api-key-form" onSubmit={(event) => {
          event.preventDefault();
          if (!apiKey.trim() || savingApiKey) return;
          setSavingApiKey(true); setApiKeyError(null); setApiKeyMessage(null);
          void localRepository.setApiKey(apiKey)
            .then(() => {
              setApiKey('');
              setApiKeyStatus({ configured: true, persisted: true });
              setApiKeyMessage('API key saved locally. ANON will not display it again.');
            })
            .catch(() => setApiKeyError('ANON could not protect and save that key. Check the value and try again.'))
            .finally(() => setSavingApiKey(false));
        }}>
          <label htmlFor="youtube-api-key">YouTube Data API key</label>
          <div><input id="youtube-api-key" type="password" autoComplete="off" spellCheck={false} disabled={!nativeRuntime || savingApiKey} value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder={nativeRuntime ? 'Paste your own key' : 'Available in the installed app'} /><button className="button" type="submit" disabled={!nativeRuntime || savingApiKey || !apiKey.trim()}>{savingApiKey ? 'Saving…' : 'Save key'}</button></div>
        </form>
        <div className="api-key-actions">
          {apiKeyStatus.configured ? <button className="button button--danger-quiet" disabled={!nativeRuntime} onClick={() => setConfirmRemoveKey(true)}>Remove key</button> : null}
          <p>ANON never bundles a shared developer key. Restrict your key to YouTube Data API v3 in Google Cloud.</p>
        </div>
        {apiKeyMessage ? <p className="settings-success" role="status">{apiKeyMessage}</p> : null}
        {apiKeyError ? <p className="danger-error" role="alert">{apiKeyError}</p> : null}
      </section>

      <section className="privacy-dashboard">
        <div className="privacy-heading"><ShieldCheck size={26} /><div><h2>Privacy, made legible</h2><p>What ANON does—and what using YouTube still requires.</p></div></div>
        <div className="privacy-stats">
          <div><EyeOff size={19} /><span>Telemetry</span><strong>OFF</strong></div>
          <div><UserRoundX size={19} /><span>ANON account</span><strong>NONE</strong></div>
          <div><HardDrive size={19} /><span>Cloud history</span><strong>NONE</strong></div>
          <div><Database size={19} /><span>Local watches</span><strong>{stats.historyCount}</strong></div>
          <div><Database size={19} /><span>Local follows</span><strong>{stats.followCount}</strong></div>
          <div><Database size={19} /><span>Local data size</span><strong>{formatBytes(stats.approximateBytes)}</strong></div>
        </div>
        <div className="privacy-columns">
          <div><h3><HardDrive size={18} /> Stored locally on this device</h3><ul><li>Watch history and playback positions</li><li>Submitted search history, when enabled</li><li>Local channel follows and settings</li><li>Cached YouTube search responses and metadata</li></ul></div>
          <div><h3><Wifi size={18} /> Sent to YouTube when used</h3><ul><li>Search terms and result-page tokens</li><li>Requested video IDs and player configuration</li><li>Network and request context needed for API, thumbnails, playback, and ads</li><li>Player interactions handled under YouTube’s own policies</li></ul></div>
        </div>
        <p className="privacy-truth">YouTube states that privacy-enhanced embedded views do not influence the viewer’s YouTube browsing experience and use non-personalized ads. It does not stop Google from receiving the playback request. The SQLite database is not encrypted, and clearing ANON data does not clear YouTube cookies or cache owned by the WebView.</p>
      </section>

      <section className="settings-section about-section"><h2>About</h2><div className="setting-row"><div><h3>ANON Alpha</h3><p>Early Windows release. Privacy promises are deliberate; compatibility and player behavior may still vary by Windows/WebView2 environment.</p></div><span className="managed-value">0.1.0</span></div></section>

      <section className="danger-zone"><div><h2>Clear ANON data</h2><p>Delete ANON’s active history, progress, follows, settings, search history, and caches. Your protected API key, YouTube/WebView data, and copies outside ANON are not included.</p>{clearError ? <p className="danger-error" role="alert">{clearError}</p> : null}</div><button className="button button--danger" onClick={() => setConfirmClear(true)}>Clear ANON data</button></section>
      <ConfirmDialog open={confirmRemoveKey} title="Remove your YouTube API key?" body="ANON will delete its protected local key file and YouTube search will stop working until you add a key again. Your Google Cloud key itself is not revoked." confirmLabel="Remove key" dangerous onCancel={() => setConfirmRemoveKey(false)} onConfirm={() => {
        setApiKeyError(null); setApiKeyMessage(null);
        void localRepository.removeApiKey()
          .then(() => { setApiKeyStatus({ configured: false, persisted: false }); setConfirmRemoveKey(false); setApiKeyMessage('The protected API key was removed from ANON.'); })
          .catch(() => setApiKeyError('ANON could not remove the protected API key.'));
      }} />
      <ConfirmDialog open={confirmClear} title="Clear ANON’s local records?" body="This deletes the data ANON actively reads from its local store and attempts to compact the database. It does not alter your protected API key, YouTube data, or copies outside ANON, such as backups." confirmLabel={clearing ? 'Clearing…' : 'Clear local data'} dangerous onCancel={() => { if (!clearing) setConfirmClear(false); }} onConfirm={() => {
        if (clearing) return;
        setClearing(true); setClearError(null);
        void clearLocalData()
          .then(async () => { setStats(await localRepository.getStats()); setConfirmClear(false); })
          .catch(() => setClearError('ANON could not clear the local store. Nothing was reported as deleted.'))
          .finally(() => setClearing(false));
      }} />
    </div>
  );
}
