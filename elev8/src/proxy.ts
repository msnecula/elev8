import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

const PUBLIC_ROUTES = ['/login', '/forgot-password', '/reset-password', '/invite', '/privacy'];

// Helper: copy session cookies from updateSession's response onto any redirect,
// so token refreshes aren't lost when we redirect unauthenticated requests.
function redirectWithCookies(
  url: URL | string,
  supabaseResponse: NextResponse,
): NextResponse {
  const redirectResponse = NextResponse.redirect(url);
  supabaseResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie.name, cookie.value);
  });
  return redirectResponse;
}

export async function proxy(request: NextRequest) {
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

  // Not authenticated → redirect to login (carry any refreshed cookies)
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', pathname);
    return redirectWithCookies(url, supabaseResponse);
  }

  const role = (user.user_metadata?.role as string) ?? 'client';

  // Clients can't access internal routes
  const INTERNAL_PREFIXES = ['/notices', '/jobs', '/proposals', '/schedule', '/work-orders', '/dispatch', '/technician', '/settings'];
  if (role === 'client' && INTERNAL_PREFIXES.some((p) => pathname.startsWith(p))) {
    return redirectWithCookies(new URL('/client', request.url), supabaseResponse);
  }

  // Non-clients can't access client portal
  if (role !== 'client' && pathname.startsWith('/client')) {
    return redirectWithCookies(new URL('/dashboard', request.url), supabaseResponse);
  }

  // Technicians only see /technician and /dashboard
  if (
    role === 'technician' &&
    !pathname.startsWith('/technician') &&
    !pathname.startsWith('/dashboard') &&
    !pathname.startsWith('/api')
  ) {
    return redirectWithCookies(new URL('/technician', request.url), supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  // Exclude: Next.js internals, static assets, PWA files (manifest, sw.js),
  // and common public file extensions that need no auth check.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.json|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml|webmanifest|json)$).*)',
  ],
};
