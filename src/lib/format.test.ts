import { describe, expect, it } from 'vitest';
import { formatAgo, formatDistance, formatDuration, formatRelativeDate, STATUS_LABELS } from './format';
import { homeFor } from './routes';
import { ORDER_STATUSES } from '@/services/types';

describe('formatters', () => {
  it('formatDistance switches to km with sensible precision', () => {
    expect(formatDistance(0)).toBe('0 m');
    expect(formatDistance(842.4)).toBe('842 m');
    expect(formatDistance(1_000)).toBe('1.0 km');
    expect(formatDistance(7_790)).toBe('7.8 km');
    expect(formatDistance(12_400)).toBe('12 km');
  });

  it('formatRelativeDate is relative within a day, then a date', () => {
    const now = Date.parse('2026-11-21T12:00:00Z');
    expect(formatRelativeDate('2026-11-21T11:48:00Z', now)).toBe('12 min ago');
    expect(formatRelativeDate('2026-11-21T09:00:00Z', now)).toBe('3 h ago');
    const older = formatRelativeDate('2026-11-04T09:00:00Z', now);
    expect(older).not.toMatch(/ago/);
    expect(older).toMatch(/4/);
  });

  it('formatDuration rounds to minutes and hours', () => {
    expect(formatDuration(30)).toBe('< 1 min');
    expect(formatDuration(89)).toBe('1 min');
    expect(formatDuration(768)).toBe('13 min');
    expect(formatDuration(3_600)).toBe('1 h 0 min');
    expect(formatDuration(5_430)).toBe('1 h 31 min');
  });

  it('formatAgo describes how long ago something happened', () => {
    const now = 1_000_000_000;
    expect(formatAgo(now, now)).toBe('just now');
    expect(formatAgo(now + 5_000, now)).toBe('just now'); // clock skew never goes negative
    expect(formatAgo(now - 20_000, now)).toBe('20s ago');
    expect(formatAgo(now - 5 * 60_000, now)).toBe('5 min ago');
    expect(formatAgo(now - 3 * 3_600_000, now)).toBe('3 h ago');
  });

  it('has a label for every order status', () => {
    for (const status of ORDER_STATUSES) expect(STATUS_LABELS[status]).toBeTruthy();
  });
});

describe('homeFor', () => {
  it('sends each role to its own area', () => {
    expect(homeFor('admin')).toBe('/admin/dispatch');
    expect(homeFor('rider')).toBe('/rider/dashboard');
    expect(homeFor('customer')).toBe('/customer');
  });
});
