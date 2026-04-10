import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/invite'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow public routes and Next.js internals
  if (
    PUBLIC_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/api/webhooks') ||
    pathname === '/'
  ) {
    const { supabaseResponse } = await updateSession(request);
    return supabaseResponse;
  }

  const { supabaseResponse, user } = await updateSession(request);

  // Not authenticated → redirect to login
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return NextResponse.redirect(url);
  }

  const role = (user.user_metadata?.role as string) ?? 'client';

  // Clients can't access internal routes
  const INTERNAL_PREFIXES = ['/notices', '/jobs', '/proposals', '/schedule', '/work-orders', '/dispatch', '/technician', '/settings'];
  if (role === 'client' && INTERNAL_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.redirect(new URL('/client', request.url));
  }

  // Non-clients can't access client portal
  if (role !== 'client' && pathname.startsWith('/client')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Technicians only see /technician and /dashboard
  if (
    role === 'technician' &&
    !pathname.startsWith('/technician') &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/api')
  ) {
    return NextResponse.redirect(new URL('/technician', request.url));
  }

  // /dashboard redirects by role
  if (pathname === '/dashboard') {
    const destinations: Record<string, string> = {
      admin: '/notices',
      reviewer: '/notices',
      dispatcher: '/dispatch',
      technician: '/technician',
      client: '/client',
    };
    const dest = destinations[role] ?? '/login';
    return NextResponse.redirect(new URL(dest, request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
