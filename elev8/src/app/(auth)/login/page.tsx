import type { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign In' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string; error?: string }>;
}) {
  const params = await searchParams;
  return (
    <LoginForm
      redirectTo={params.redirectTo}
      errorParam={params.error}
    />
  );
}
