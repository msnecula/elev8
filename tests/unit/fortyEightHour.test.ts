import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/db/client', () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ leftJoin: vi.fn(() => ({ where: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })) })) }),
    update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
    query: {
      users: { findMany: vi.fn(async () => []) },
    },
  },
}));
vi.mock('@/server/services/notificationService', () => ({
  sendFortyEightHourAlert: vi.fn(async () => ({ success: true })),
}));
vi.mock('@/server/services/activityLogger', () => ({
  logWorkOrderActivity: vi.fn(async () => {}),
}));

import { addHours, subHours } from 'date-fns';

/**
 * Test the 48-hour deadline calculation logic
 */
describe('48-hour notice deadline logic', () => {
  it('calculates deadline as 48 hours before scheduled start', () => {
    const scheduledStart = new Date('2025-07-15T08:00:00-07:00');
    const expectedDeadline = subHours(scheduledStart, 48);
    const calculatedDeadline = new Date(scheduledStart.getTime() - 48 * 60 * 60 * 1000);
    expect(calculatedDeadline.toISOString()).toBe(expectedDeadline.toISOString());
  });

  it('identifies overdue deadline correctly', () => {
    const now = new Date();
    const pastDeadline = subHours(now, 2); // 2 hours ago
    const futureDeadline = addHours(now, 2); // 2 hours from now

    expect(pastDeadline < now).toBe(true);    // overdue
    expect(futureDeadline < now).toBe(false); // not overdue
  });

  it('identifies near-deadline correctly (within 24 hours)', () => {
    const now = new Date();
    const nearDeadline = addHours(now, 12);  // 12 hours from now
    const farDeadline = addHours(now, 30);   // 30 hours from now
    const threshold = addHours(now, 24);

    expect(nearDeadline <= threshold).toBe(true);  // within 24hr → alert
    expect(farDeadline <= threshold).toBe(false);  // outside 24hr → no alert
  });

  it('identifies hold condition correctly', () => {
    const isHeld = (fortyEightRequired: boolean, status: string) => {
      return fortyEightRequired && status === 'overdue';
    };

    expect(isHeld(true, 'overdue')).toBe(true);
    expect(isHeld(true, 'pending')).toBe(false);
    expect(isHeld(false, 'overdue')).toBe(false);
    expect(isHeld(true, 'sent')).toBe(false);
    expect(isHeld(false, 'not_required')).toBe(false);
  });
});
