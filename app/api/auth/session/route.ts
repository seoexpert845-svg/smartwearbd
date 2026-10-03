import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import User from '@/models/User';

export async function GET(request: Request) {
  const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
  const session = verifySession(token);
  if (!session) return NextResponse.json({ success: true, data: null });
  if (session.role === 'admin') return NextResponse.json({ success: true, data: { role: 'admin' } });

  try {
    await connectDB();
    const user = await User.findById(session.sub).select('name phone district thana role').lean();
    if (!user || user.role === 'admin') return NextResponse.json({ success: true, data: null });
    return NextResponse.json({ success: true, data: { name: user.name, phone: user.phone, district: user.district, thana: user.thana, role: 'user' } });
  } catch {
    return NextResponse.json({ success: false, error: 'অ্যাকাউন্টের তথ্য লোড করা যায়নি।' }, { status: 500 });
  }
}
