import '@testing-library/jest-dom';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

vi.mock('@/lib/supabase/server', () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn(), getSession: vi.fn() },
  })),
}));
