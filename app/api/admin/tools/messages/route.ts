import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import CustomerMessage from '@/models/CustomerMessage';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const messages = await CustomerMessage.find().sort({ createdAt: -1 }).limit(1000).lean();
    return NextResponse.json({ success: true, data: messages });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'ইনবক্স লোড করা যায়নি।' }, { status: 500 });
  }
}
