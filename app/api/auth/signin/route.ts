import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { createSession, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const phone = String(body.phone || '').trim();
    const password = String(body.password || '');
    if (!/^01[3-9]\d{8}$/.test(phone) || !password) {
      return NextResponse.json({ success: false, error: 'ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' }, { status: 401 });
    }

    await connectDB();
    const user = await User.findOne({ phone, role: { $ne: 'admin' } }).select('+passwordHash');
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      return NextResponse.json({ success: false, error: 'ফোন নম্বর অথবা পাসওয়ার্ড সঠিক নয়।' }, { status: 401 });
    }

    const lifetime = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    const response = NextResponse.json({ success: true, data: { name: user.name, phone: user.phone, district: user.district, thana: user.thana } });
    response.cookies.set(SESSION_COOKIE, createSession({ sub: user.id, role: 'user' }, lifetime), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: lifetime });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সাইন ইন করা যায়নি।' }, { status: 500 });
  }
}
