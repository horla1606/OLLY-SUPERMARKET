import { NextRequest, NextResponse } from 'next/server';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/cart', '/checkout', '/support'];

// Routes within /dashboard that require manager role
const MANAGER_PREFIXES = ['/dashboard/admin'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const needsAuth = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  if (!needsAuth) return NextResponse.next();

  // Token is mirrored into a cookie on login (see lib/auth.ts)
  const token = request.cookies.get('olly_token')?.value;
  const role  = request.cookies.get('olly_role')?.value;

  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Manager-only routes
  const needsManager = MANAGER_PREFIXES.some((p) => pathname.startsWith(p));
  if (needsManager && !['manager', 'admin', 'staff'].includes(role ?? '')) {
    return NextResponse.redirect(new URL('/dashboard/customer', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/cart', '/checkout', '/support'],
};
