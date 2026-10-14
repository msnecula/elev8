import { createHmac, timingSafeEqual } from 'crypto';

// Signed, self-contained token for confirming a self-service email change.
// It names the user, the address being replaced and the new address, so it only
// works while the account still has the old address — once applied (or after any
// later change) it is useless, which makes it effectively single-use.

export interface EmailChangeClaims {
  userId: string;
  fromEmail: string;
  toEmail: string;
  /** Expiry, seconds since epoch. */
  expiresAt: number;
}

export const EMAIL_CHANGE_TTL_SECONDS = 24 * 60 * 60;

function sign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url');
}

export function createEmailChangeToken(
  claims: Omit<EmailChangeClaims, 'expiresAt'>,
  secret: string,
  now = Date.now(),
): string {
  const full: EmailChangeClaims = { ...claims, expiresAt: Math.floor(now / 1000) + EMAIL_CHANGE_TTL_SECONDS };
  const payload = Buffer.from(JSON.stringify(full)).toString('base64url');
  return `${payload}.${sign(payload, secret)}`;
}

export type EmailChangeTokenResult =
  | { ok: true; claims: EmailChangeClaims }
  | { ok: false; reason: 'malformed' | 'bad-signature' | 'expired' };

export function verifyEmailChangeToken(token: string, secret: string, now = Date.now()): EmailChangeTokenResult {
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra !== undefined) return { ok: false, reason: 'malformed' };

  const expected = Buffer.from(sign(payload, secret));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'bad-signature' };
  }

  let claims: EmailChangeClaims;
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    return { ok: false, reason: 'malformed' };
  }
  if (
    typeof claims?.userId !== 'string' || typeof claims.fromEmail !== 'string'
    || typeof claims.toEmail !== 'string' || typeof claims.expiresAt !== 'number'
  ) {
    return { ok: false, reason: 'malformed' };
  }
  if (claims.expiresAt * 1000 < now) return { ok: false, reason: 'expired' };
  return { ok: true, claims };
}
