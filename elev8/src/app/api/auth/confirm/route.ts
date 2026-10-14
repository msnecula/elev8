import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { EMAIL_LINK_TYPES, type EmailLinkType } from '@/lib/validation/users';

// Submitted by the "Continue" button on /invite. Verifying the one-time token
// hash sets the session cookie; the user is then sent to choose a password.
// 303 so the browser follows with a GET.
export async function POST(request: Request) {
  const { origin } = new URL(request.url);
  const form = await request.formData();
  const tokenHash = form.get('token_hash');
  const type = form.get('type');

  if (typeof tokenHash === 'string' && tokenHash && EMAIL_LINK_TYPES.includes(type as EmailLinkType)) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({ type: type as EmailLinkType, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}/reset-password`, 303);
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`, 303);
}

// A GET never spends the token (mail scanners prefetch links); send it to the
// confirmation page instead.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const invite = new URL('/invite', url.origin);
  for (const key of ['token_hash', 'type']) {
    const value = url.searchParams.get(key);
    if (value) invite.searchParams.set(key, value);
  }
  return NextResponse.redirect(invite);
}
