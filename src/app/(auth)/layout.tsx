import { APP_NAME } from '@/lib/constants';
import Link from 'next/link';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center">
          <Link href="/" className="inline-flex items-center gap-2 text-slate-800 hover:text-slate-600">
            <div className="h-9 w-9 rounded-xl bg-blue-600 flex items-center justify-center">
              <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V7M3 7l9-4 9 4M3 7h18" />
              </svg>
            </div>
            <span className="text-xl font-bold">{APP_NAME}</span>
          </Link>
        </div>
        {children}
      </div>
    </div>
  );
}
