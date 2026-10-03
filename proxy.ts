import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/admin/login') return NextResponse.next();

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const session = verifySession(token);
  if (session?.role === 'admin') return NextResponse.next();

  const loginUrl = new URL('/admin/login', request.url);
  if (session?.role === 'user') loginUrl.searchParams.set('reason', 'admin-only');
  return NextResponse.redirect(loginUrl);
}

export const config = { matcher: ['/admin/:path*'] };
