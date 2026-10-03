import { NextResponse } from 'next/server';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

export function requireAdmin(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = verifySession(token);
  if (session?.role === 'admin') return null;
  return NextResponse.json({ success: false, error: 'এই কাজের জন্য অ্যাডমিন অনুমতি প্রয়োজন।' }, { status: 403 });
}

export function getAdminActor(request: Request) {
  const cookie = request.headers.get('cookie') || '';
  const token = cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = verifySession(token);
  return session?.role === 'admin' ? session.sub : '';
}
