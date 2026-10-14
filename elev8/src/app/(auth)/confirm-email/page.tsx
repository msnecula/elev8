import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { verifyEmailChangeToken } from '@/lib/emailChangeToken';
import { emailChangeSecret } from '@/server/services/userAccounts';

export const metadata: Metadata = { title: 'Confirm Email Change' };

const OUTCOMES: Record<string, { title: string; text: string }> = {
  done: {
    title: 'Email updated',
    text: 'Your new email is confirmed. Use it the next time you sign in — your password stays the same.',
  },
  expired: {
    title: 'Link expired',
    text: 'This confirmation link is more than 24 hours old. Request the change again from your account page.',
  },
  taken: {
    title: 'Email already in use',
    text: 'Another account now uses that address, so the change was not made. Contact your administrator.',
  },
  failed: {
    title: 'Something went wrong',
    text: 'Your email was not changed. Please try the link again, or contact your administrator.',
  },
  invalid: {
    title: 'Link no longer valid',
    text: 'This link was already used, or your email has changed since it was sent. Nothing was changed.',
  },
};

// Landing page for the link in the "confirm your new email" message. Shows what
// will change and asks for a click (POST) so mail scanners can't apply it.
export default async function ConfirmEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; status?: string }>;
}) {
  const { token, status } = await searchParams;

  if (status) {
    const outcome = OUTCOMES[status] ?? OUTCOMES.invalid;
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-center">{outcome.title}</CardTitle>
          <CardDescription className="text-center">{outcome.text}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* /dashboard sends signed-out visitors to the login page anyway. */}
          <Button asChild variant={status === 'done' ? 'default' : 'outline'} className="w-full">
            <Link href="/dashboard">Continue</Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  const result = token ? verifyEmailChangeToken(token, emailChangeSecret()) : null;
  if (!result?.ok) {
    const outcome = result?.reason === 'expired' ? OUTCOMES.expired : OUTCOMES.invalid;
    return (
      <Card className="shadow-lg">
        <CardHeader className="pb-4">
          <CardTitle className="text-2xl font-bold text-center">{outcome.title}</CardTitle>
          <CardDescription className="text-center">{outcome.text}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const { fromEmail, toEmail } = result.claims;
  return (
    <Card className="shadow-lg">
      <CardHeader className="pb-4">
        <CardTitle className="text-2xl font-bold text-center">Confirm your new email</CardTitle>
        <CardDescription className="text-center">
          Change your sign-in email from <strong>{fromEmail}</strong> to <strong>{toEmail}</strong>?
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action="/api/auth/confirm-email" method="post">
          <input type="hidden" name="token" value={token} />
          <Button type="submit" className="w-full">Confirm New Email</Button>
        </form>
      </CardContent>
    </Card>
  );
}
