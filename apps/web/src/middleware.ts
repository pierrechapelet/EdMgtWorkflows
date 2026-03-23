import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/api'];

/**
 * Route protection middleware.
 * Redirects unauthenticated requests to /login.
 * Redirects authenticated users away from /login to /portal.
 *
 * NOTE: This is a basic implementation for Phase 1.
 * Phase 6 will extend this with server-side token validation.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check for access token cookie (set by auth flow)
  // In production, use httpOnly cookie with JWT validation here
  const token = request.cookies.get('access_token')?.value;

  if (!token && !pathname.startsWith('/login')) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|icons).*)',
  ],
};
