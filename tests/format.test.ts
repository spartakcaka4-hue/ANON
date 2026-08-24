import { describe, expect, it } from 'vitest';
import { formatCount, formatDuration, parseIsoDuration } from '../src/utils/format';
import { isVideoId, normalizeQuery, safeThumbnail } from '../src/utils/validation';

describe('formatting and remote-data validation', () => {
  it('formats player durations without losing hours', () => {
    expect(formatDuration(65)).toBe('1:05');
    expect(formatDuration(3661)).toBe('1:01:01');
    expect(parseIsoDuration('PT2H3M4S')).toBe(7384);
    expect(formatCount(1, 'video')).toBe('1 video');
    expect(formatCount(1200, 'subscriber')).toBe('1.2K subscribers');
  });

  it('normalizes only submitted search text', () => {
    expect(normalizeQuery('  slow   television  ')).toBe('slow television');
    expect(normalizeQuery('x'.repeat(130))).toHaveLength(120);
  });

  it('allowlists video IDs and thumbnail hosts', () => {
    expect(isVideoId('dQw4w9WgXcQ')).toBe(true);
    expect(isVideoId('../invalid')).toBe(false);
    expect(safeThumbnail('https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg')).toContain('i.ytimg.com');
    expect(safeThumbnail('https://example.com/tracker.png')).toBeNull();
  });
});
