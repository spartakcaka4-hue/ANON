const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });
const date = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' });

export function formatDuration(total: number | null): string {
  if (total === null || !Number.isFinite(total)) return '—';
  const seconds = Math.max(0, Math.floor(total));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainder = seconds % 60;
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`
    : `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatViews(value: number | null): string | null {
  return value === null ? null : `${compact.format(value)} views`;
}

export function formatCount(value: number | null, singular: string, plural = `${singular}s`): string | null {
  if (value === null) return null;
  return `${compact.format(value)} ${value === 1 ? singular : plural}`;
}

export function formatDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.valueOf()) ? null : date.format(parsed);
}

export function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  if (value < 1024 ** 2) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / 1024 ** 2).toFixed(1)} MB`;
}

export function parseIsoDuration(value?: string): number | null {
  if (!value) return null;
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(value);
  if (!match) return null;
  return Number(match[1] ?? 0) * 3600 + Number(match[2] ?? 0) * 60 + Number(match[3] ?? 0);
}
