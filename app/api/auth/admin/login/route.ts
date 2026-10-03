import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { createSession, secureStringEqual, SESSION_COOKIE, verifyPassword } from '@/lib/auth';
import User from '@/models/User';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) return NextResponse.json({ success: false, error: 'ইমেইল ও পাসওয়ার্ড সঠিক নয়।' }, { status: 401 });

    await connectDB();
    const admin = await User.findOne({ email, role: 'admin' }).select('+passwordHash');
    let adminId = '';
    if (admin?.passwordHash && verifyPassword(password, admin.passwordHash)) adminId = admin.id;

    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
    const configuredPassword = process.env.ADMIN_PASSWORD || '';
    const configuredPasswordHash = process.env.ADMIN_PASSWORD_HASH || '';
    if (!admin && configuredEmail && secureStringEqual(email, configuredEmail) && (
      (configuredPasswordHash && verifyPassword(password, configuredPasswordHash)) ||
      (configuredPassword && secureStringEqual(password, configuredPassword))
    )) {
      adminId = `env:${configuredEmail}`;
    }
    if (!adminId) return NextResponse.json({ success: false, error: 'অ্যাডমিন ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।' }, { status: 401 });

    const lifetime = body.remember ? 60 * 60 * 24 * 30 : 60 * 60 * 24;
    const response = NextResponse.json({ success: true });
    response.cookies.set(SESSION_COOKIE, createSession({ sub: adminId, role: 'admin' }, lifetime), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: lifetime });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'অ্যাডমিন সাইন ইন করা যায়নি।' }, { status: 500 });
  }
}
