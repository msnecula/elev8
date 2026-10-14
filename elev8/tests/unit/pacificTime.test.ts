import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { formatDate, parsePacificDateTime, toPacificDateTimeInput, todayPacific } from '@/lib/utils';

// Vercel runs the server in UTC; these must give California answers regardless.
const originalTz = process.env.TZ;
beforeAll(() => { process.env.TZ = 'UTC'; });
afterAll(() => { process.env.TZ = originalTz; vi.useRealTimers(); });

describe('Pacific time helpers (server clock in UTC)', () => {
  it('reads a typed date-time as California time, in summer and winter', () => {
    // PDT is UTC-7, PST is UTC-8
    expect(parsePacificDateTime('2026-10-20T08:00').toISOString()).toBe('2026-10-20T15:00:00.000Z');
    expect(parsePacificDateTime('2026-12-15T08:00').toISOString()).toBe('2026-12-15T16:00:00.000Z');
  });

  it('keeps a value that already carries a zone', () => {
    expect(parsePacificDateTime('2026-10-20T08:00:00Z').toISOString()).toBe('2026-10-20T08:00:00.000Z');
    expect(parsePacificDateTime('2026-10-20T08:00:00-07:00').toISOString()).toBe('2026-10-20T15:00:00.000Z');
  });

  it('shows instants in California time', () => {
    expect(formatDate('2026-10-20T15:00:00.000Z', 'MMM d, yyyy h:mm a')).toBe('Oct 20, 2026 8:00 AM');
    // 2am UTC on the 21st is still the evening of the 20th in California
    expect(formatDate(new Date('2026-10-21T02:00:00Z'), 'MMM d')).toBe('Oct 20');
  });

  it('prints calendar dates as written, without shifting a day', () => {
    expect(formatDate('2026-10-20')).toBe('Oct 20, 2026');
  });

  it('round-trips a datetime-local value', () => {
    const typed = '2026-11-03T13:30';
    expect(toPacificDateTimeInput(parsePacificDateTime(typed))).toBe(typed);
  });

  it("uses California's date for today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-21T05:30:00Z')); // 10:30pm Oct 20 in California
    expect(todayPacific()).toBe('2026-10-20');
    expect(todayPacific(1)).toBe('2026-10-21');
    vi.useRealTimers();
  });
});
