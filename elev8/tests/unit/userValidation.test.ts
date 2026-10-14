import { describe, it, expect } from 'vitest';
import {
  adminUserSchema,
  ownProfileSchema,
  passwordSchema,
  safeNextPath,
} from '@/lib/validation/users';

const base = { fullName: 'David Kim', email: 'David.Kim@Example.com', role: 'technician' as const };

describe('adminUserSchema', () => {
  it('normalizes email and turns blank optional fields into undefined', () => {
    const parsed = adminUserSchema.parse({ ...base, phone: '  ', accountId: '', cccmLicense: ' 123456 ', qeiNumber: '' });
    expect(parsed.email).toBe('david.kim@example.com');
    expect(parsed.phone).toBeUndefined();
    expect(parsed.accountId).toBeUndefined();
    expect(parsed.cccmLicense).toBe('123456');
    expect(parsed.qeiNumber).toBeUndefined();
  });

  it('keeps leading zeros in license numbers', () => {
    expect(adminUserSchema.parse({ ...base, qeiNumber: '00001' }).qeiNumber).toBe('00001');
  });

  it('requires a company account for clients only', () => {
    const client = adminUserSchema.safeParse({ ...base, role: 'client' });
    expect(client.success).toBe(false);
    expect(client.error?.issues[0]?.path).toEqual(['accountId']);

    const withAccount = adminUserSchema.safeParse({
      ...base, role: 'client', accountId: '6f1c2b1e-8a43-4b8e-9f3e-2d7a5c1b0e91',
    });
    expect(withAccount.success).toBe(true);
    expect(adminUserSchema.safeParse({ ...base, role: 'dispatcher' }).success).toBe(true);
  });

  it('rejects unknown roles, bad emails and short names', () => {
    expect(adminUserSchema.safeParse({ ...base, role: 'owner' }).success).toBe(false);
    expect(adminUserSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
    expect(adminUserSchema.safeParse({ ...base, fullName: 'D' }).success).toBe(false);
  });
});

describe('ownProfileSchema', () => {
  it('trims the name and allows clearing the phone', () => {
    expect(ownProfileSchema.parse({ fullName: '  Sam Lee ', phone: '' })).toEqual({ fullName: 'Sam Lee', phone: undefined });
  });
});

describe('passwordSchema', () => {
  it('requires 8+ characters and a matching confirmation', () => {
    expect(passwordSchema.safeParse({ password: 'short', confirmPassword: 'short' }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: 'long-enough', confirmPassword: 'different' }).success).toBe(false);
    expect(passwordSchema.safeParse({ password: 'long-enough', confirmPassword: 'long-enough' }).success).toBe(true);
  });
});

describe('safeNextPath', () => {
  it('allows same-site relative paths', () => {
    expect(safeNextPath('/reset-password')).toBe('/reset-password');
  });

  it('falls back for off-site or malformed targets', () => {
    for (const bad of ['https://evil.example', '//evil.example', '/\\evil.example', 'reset-password', '', null, undefined]) {
      expect(safeNextPath(bad, '/fallback')).toBe('/fallback');
    }
  });
});
