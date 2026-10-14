import { describe, it, expect } from 'vitest';
import {
  createEmailChangeToken,
  verifyEmailChangeToken,
  EMAIL_CHANGE_TTL_SECONDS,
} from '@/lib/emailChangeToken';

const SECRET = 'test-secret';
const claims = { userId: 'user-1', fromEmail: 'old@example.com', toEmail: 'new@example.com' };
const NOW = Date.UTC(2026, 9, 14, 12, 0, 0);

describe('email change token', () => {
  it('round-trips its claims', () => {
    const token = createEmailChangeToken(claims, SECRET, NOW);
    const result = verifyEmailChangeToken(token, SECRET, NOW + 1000);
    expect(result).toEqual({
      ok: true,
      claims: { ...claims, expiresAt: Math.floor(NOW / 1000) + EMAIL_CHANGE_TTL_SECONDS },
    });
  });

  it('expires after 24 hours', () => {
    const token = createEmailChangeToken(claims, SECRET, NOW);
    expect(verifyEmailChangeToken(token, SECRET, NOW + (EMAIL_CHANGE_TTL_SECONDS - 60) * 1000).ok).toBe(true);
    expect(verifyEmailChangeToken(token, SECRET, NOW + (EMAIL_CHANGE_TTL_SECONDS + 60) * 1000))
      .toEqual({ ok: false, reason: 'expired' });
  });

  it('rejects a different secret', () => {
    const token = createEmailChangeToken(claims, SECRET, NOW);
    expect(verifyEmailChangeToken(token, 'other-secret', NOW)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects a payload edited to point at another address', () => {
    const [, signature] = createEmailChangeToken(claims, SECRET, NOW).split('.');
    const forged = Buffer.from(JSON.stringify({ ...claims, toEmail: 'attacker@example.com', expiresAt: 9e9 })).toString('base64url');
    expect(verifyEmailChangeToken(`${forged}.${signature}`, SECRET, NOW)).toEqual({ ok: false, reason: 'bad-signature' });
  });

  it('rejects malformed tokens', () => {
    for (const bad of ['', 'abc', 'a.b.c', '.sig', 'payload.']) {
      expect(verifyEmailChangeToken(bad, SECRET, NOW).ok).toBe(false);
    }
  });
});
