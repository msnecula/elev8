import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase/server';
import { EMAIL_LINK_TYPES, safeNextPath, type EmailLinkType } from '@/lib/validation/users';

// Landing point for invite and "set your password" emails. The link carries a
// one-time token hash; verifying it here sets the session cookie, then the user
// is sent on to choose a password.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailLinkType | null;
  const next = safeNextPath(searchParams.get('next'), '/reset-password');

  if (tokenHash && type && EMAIL_LINK_TYPES.includes(type)) {
    const supabase = await createServerClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=invite_link_invalid`);
}
