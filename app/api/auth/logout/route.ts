import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  try {
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, '', { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 0 });
    return response;
  } catch (error) {
    console.error('Logout Error:', error);
    return NextResponse.json({ success: false, error: 'সাইন আউট করা যায়নি।' }, { status: 500 });
  }
}
