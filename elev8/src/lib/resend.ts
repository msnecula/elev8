import 'server-only';
import { Resend } from 'resend';

if (!process.env.RESEND_API_KEY) {
  throw new Error('RESEND_API_KEY is not set — add it to .env.local');
}

export const resend = new Resend(process.env.RESEND_API_KEY);

export const EMAIL_FROM = `${process.env.RESEND_FROM_NAME ?? 'Elev8 Comply'} <${
  process.env.RESEND_FROM_EMAIL ?? 'no-reply@elev8comply.com'
}>`;
