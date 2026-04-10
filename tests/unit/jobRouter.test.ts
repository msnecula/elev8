import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/server/db/client', () => ({
  db: {
    query: {
      users: {
        findFirst: vi.fn(),
      },
    },
  },
}));

import { assignReviewer } from '@/server/services/jobRouter';
import { db } from '@/server/db/client';

const mockFindFirst = vi.mocked(db.query.users.findFirst);

describe('assignReviewer', () => {
  beforeEach(() => vi.clearAllMocks());

  it('assigns admin for critical urgency', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'admin-uuid' } as never);
    const result = await assignReviewer('critical', 'commercial');
    expect(result).toBe('admin-uuid');
  });

  it('assigns reviewer for non-critical urgency', async () => {
    mockFindFirst.mockResolvedValueOnce({ id: 'reviewer-uuid' } as never);
    const result = await assignReviewer('high', 'residential');
    expect(result).toBe('reviewer-uuid');
  });

  it('falls back to admin when no reviewer exists', async () => {
    // First call (reviewer lookup) returns null, second (admin fallback) returns admin
    mockFindFirst
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ id: 'admin-uuid' } as never);

    const result = await assignReviewer('medium', 'commercial');
    expect(result).toBe('admin-uuid');
  });

  it('returns null when no users exist', async () => {
    mockFindFirst.mockResolvedValue(null as never);
    const result = await assignReviewer('low', 'residential');
    expect(result).toBeNull();
  });
});
