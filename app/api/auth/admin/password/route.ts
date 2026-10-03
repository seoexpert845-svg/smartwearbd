import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { createSession, hashPassword, secureStringEqual, SESSION_COOKIE, verifyPassword, verifySession } from '@/lib/auth';
import { requireAdmin } from '@/lib/auth-api';
import User from '@/models/User';

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const session = verifySession(token);
    if (!session || session.role !== 'admin') return NextResponse.json({ success: false, error: 'অ্যাডমিন সেশন পাওয়া যায়নি।' }, { status: 401 });

    const body = await request.json();
    const currentPassword = String(body.currentPassword || '');
    const newPassword = String(body.newPassword || '');
    const confirmPassword = String(body.confirmPassword || '');
    if (newPassword.length < 8) return NextResponse.json({ success: false, error: 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।' }, { status: 400 });
    if (newPassword !== confirmPassword) return NextResponse.json({ success: false, error: 'নতুন পাসওয়ার্ড দুটি মিলছে না।' }, { status: 400 });

    await connectDB();
    const configuredEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase() || '';
    const envSession = session.sub.startsWith('env:');
    const email = envSession ? session.sub.slice(4) : '';
    const admin = envSession
      ? await User.findOne({ email, role: 'admin' }).select('+passwordHash')
      : await User.findById(session.sub).select('+passwordHash');
    if ((!admin || admin.role !== 'admin') && !(envSession && configuredEmail === email)) {
      return NextResponse.json({ success: false, error: 'অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।' }, { status: 404 });
    }

    const currentMatches = admin?.passwordHash
      ? verifyPassword(currentPassword, admin.passwordHash)
      : envSession && configuredEmail === email && (
        (process.env.ADMIN_PASSWORD_HASH && verifyPassword(currentPassword, process.env.ADMIN_PASSWORD_HASH)) ||
        (process.env.ADMIN_PASSWORD && secureStringEqual(currentPassword, process.env.ADMIN_PASSWORD))
      );
    if (!currentMatches) return NextResponse.json({ success: false, error: 'বর্তমান পাসওয়ার্ড সঠিক নয়।' }, { status: 401 });
    if (verifyPassword(newPassword, admin?.passwordHash || '')) return NextResponse.json({ success: false, error: 'নতুন পাসওয়ার্ডটি বর্তমান পাসওয়ার্ড থেকে আলাদা হতে হবে।' }, { status: 400 });

    const targetEmail = admin?.email || email || configuredEmail;
    if (!targetEmail) return NextResponse.json({ success: false, error: 'অ্যাডমিন ইমেইল কনফিগার করা নেই।' }, { status: 400 });
    const updated = await User.findOneAndUpdate(
      { email: targetEmail },
      { $set: { name: admin?.name || 'SmartWearBD Admin', email: targetEmail, role: 'admin', passwordHash: hashPassword(newPassword) } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    const lifetime = Math.max(1, session.exp - Math.floor(Date.now() / 1000));
    const response = NextResponse.json({ success: true, message: 'অ্যাডমিন পাসওয়ার্ড সফলভাবে আপডেট হয়েছে।' });
    response.cookies.set(SESSION_COOKIE, createSession({ sub: updated.id, role: 'admin' }, lifetime), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: lifetime });
    return response;
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'পাসওয়ার্ড আপডেট করা যায়নি।' }, { status: 500 });
  }
}
