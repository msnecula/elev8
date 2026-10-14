import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EMAIL_LINK_TYPES, type EmailLinkType } from '@/lib/validation/users';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = { title: 'Set Your Password' };

// Invite and "set your password" emails link here rather than straight to the
// verify endpoint: corporate mail scanners prefetch links, which would burn the
// one-time token. Only the button below (a POST) spends it.
export default async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ token_hash?: string; type?: string }>;
}) {
  const { token_hash: tokenHash, type } = await searchParams;
  const valid = !!tokenHash && EMAIL_LINK_TYPES.includes(type as EmailLinkType);

  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-center">
          {type === 'invite' ? `Welcome to ${APP_NAME}` : 'Set your password'}
        </CardTitle>
        <CardDescription className="text-center">
          {valid
            ? 'Continue to choose your password and sign in.'
            : 'This link is incomplete. Open the link from your email again, or ask your administrator to resend it.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {valid ? (
          <form action="/api/auth/confirm" method="post">
            <input type="hidden" name="token_hash" value={tokenHash} />
            <input type="hidden" name="type" value={type} />
            <Button type="submit" className="w-full">Continue</Button>
          </form>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href="/login">Go to sign in</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
