import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import CustomerMessage from '@/models/CustomerMessage';
import { resolveClientIp } from '@/lib/client-ip';

const messageSubmissions = new Map<string, { count: number; resetAt: number }>();

export async function POST(request: Request) {
  try {
    const body = await request.json() as { name?: string; phone?: string; email?: string; message?: string };
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const message = String(body.message || '').trim();
    if (!name || name.length > 120 || !phone || phone.length > 32 || message.length < 4 || message.length > 5000
      || email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, error: 'নাম, যোগাযোগের নম্বর এবং ৪-৫,০০০ অক্ষরের বার্তা সঠিকভাবে দিন।' }, { status: 400 });
    }
    const ip = await resolveClientIp(request);
    const current = messageSubmissions.get(ip);
    const now = Date.now();
    if (current && current.resetAt > now && current.count >= 5) {
      return NextResponse.json({ success: false, error: 'অনেকগুলো বার্তা পাঠানো হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' }, { status: 429 });
    }
    messageSubmissions.set(ip, !current || current.resetAt <= now ? { count: 1, resetAt: now + 10 * 60_000 } : { ...current, count: current.count + 1 });
    await connectDB();
    const saved = await CustomerMessage.create({ name, phone, email, message });
    return NextResponse.json({ success: true, data: { id: saved._id } }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'বার্তা পাঠানো যায়নি।' }, { status: 500 });
  }
}
