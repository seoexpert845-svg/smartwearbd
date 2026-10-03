import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { createSession, hashPassword, SESSION_COOKIE } from '@/lib/auth';
import { findBangladeshDistrict, getBangladeshUpazilas } from '@/lib/bangladesh-locations';
import User from '@/models/User';

const PHONE_PATTERN = /^01[3-9]\d{8}$/;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const district = String(body.district || '').trim();
    const thana = String(body.thana || '').trim();
    const password = String(body.password || '');
    const selectedDistrict = findBangladeshDistrict(district);
    const validThana = getBangladeshUpazilas(district).some((item) => item.english === thana || item.bangla === thana);

    if (name.length < 2 || !PHONE_PATTERN.test(phone) || !selectedDistrict || !validThana || password.length < 8) {
      return NextResponse.json({ success: false, error: 'নাম, বৈধ ফোন নম্বর, জেলা, থানা এবং কমপক্ষে ৮ অক্ষরের পাসওয়ার্ড দিন।' }, { status: 400 });
    }

    await connectDB();
    const user = await User.create({ name, phone, district: selectedDistrict.english, thana, passwordHash: hashPassword(password), role: 'user' });
    const response = NextResponse.json({ success: true, data: { name: user.name, phone: user.phone, district: user.district, thana: user.thana } }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, createSession({ sub: user.id, role: 'user' }, 60 * 60 * 24 * 30), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 30 });
    return response;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ success: false, error: 'এই ফোন নম্বরে ইতিমধ্যে একটি অ্যাকাউন্ট আছে।' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'অ্যাকাউন্ট তৈরি করা যায়নি।' }, { status: 500 });
  }
}
