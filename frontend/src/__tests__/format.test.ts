import { describe, expect, it } from 'vitest';
import { formatBytes, formatDateTime, formatDuration, formatElapsed, truncate } from '../shared/utils/format.ts';

describe('formatDateTime', () => {
  const iso = '2026-08-23T22:32:00Z';

  // The locale used to be undefined, which is the browser's language rather
  // than the one the person picked, so switching to Thai changed nothing.
  it('follows the language it is given', () => {
    expect(formatDateTime(iso, 'en')).not.toBe(formatDateTime(iso, 'th'));
  });

  it('includes the year in both languages', () => {
    expect(formatDateTime(iso, 'en')).toContain('2026');
    expect(formatDateTime(iso, 'th')).toContain('2026');
  });

  // th-TH on its own renders the Buddhist era, which would disagree with every
  // timestamp the backend logs.
  it('keeps Thai on the Gregorian year', () => {
    expect(formatDateTime(iso, 'th')).not.toContain('2569');
  });

  it('hands back input it cannot parse rather than "Invalid Date"', () => {
    expect(formatDateTime('not a date', 'en')).toBe('not a date');
  });
});

describe('formatDuration', () => {
  it('translates its units', () => {
    expect(formatDuration(12.5, 'en')).toBe('12.50s');
    expect(formatDuration(12.5, 'th')).toContain('วิ');
    expect(formatDuration(90, 'en')).toBe('1m 30s');
    expect(formatDuration(90, 'th')).toContain('นาที');
  });

  it('shows a dash when there is no duration', () => {
    expect(formatDuration(null, 'en')).toBe('—');
    expect(formatDuration(undefined, 'th')).toBe('—');
  });

  it('handles zero without pretending it is missing', () => {
    expect(formatDuration(0, 'en')).toBe('0.00s');
  });
});

describe('formatElapsed', () => {
  it('pads the seconds', () => {
    expect(formatElapsed(65_000)).toBe('1:05');
    expect(formatElapsed(0)).toBe('0:00');
  });

  it('never goes negative', () => {
    expect(formatElapsed(-5000)).toBe('0:00');
  });
});

describe('formatBytes', () => {
  it('picks a readable unit', () => {
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(2048)).toBe('2 KB');
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB');
  });
});

describe('truncate', () => {
  it('leaves short text alone', () => {
    expect(truncate('short', 10)).toBe('short');
  });

  it('never exceeds the limit it was given', () => {
    for (const max of [1, 5, 10, 40]) {
      expect(truncate('x'.repeat(100), max).length).toBeLessThanOrEqual(max);
    }
  });
});
