import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { APP_NAME } from '@/lib/constants';

export default async function HomePage() {
  const user = await getCurrentUser();
  if (user) redirect('/dashboard');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-blue-900 to-blue-700 px-4">
      <div className="text-center space-y-8 max-w-lg">
        <div className="flex items-center justify-center gap-3">
          <div className="h-14 w-14 rounded-2xl bg-white/10 backdrop-blur flex items-center justify-center">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18M12 12v5" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight">{APP_NAME}</h1>
        </div>
        <p className="text-blue-200 text-lg leading-relaxed">
          Elevator repair and compliance management. From notice intake to technician dispatch — all in one place.
        </p>
        <Button asChild size="lg" className="bg-white text-blue-900 hover:bg-blue-50 font-semibold px-8">
          <Link href="/login">Sign In</Link>
        </Button>
      </div>
    </main>
  );
}
