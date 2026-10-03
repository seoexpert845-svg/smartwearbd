import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import ExpenseCategory from '@/models/ExpenseCategory';

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { name?: string };
    const name = String(body.name || '').trim();
    if (!name || name.length > 80) return NextResponse.json({ success: false, error: 'ক্যাটাগরির নাম ১-৮০ অক্ষরের মধ্যে দিন।' }, { status: 400 });
    await connectDB();
    if (await ExpenseCategory.exists({ name: new RegExp(`^${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') })) {
      return NextResponse.json({ success: false, error: 'এই খরচের ক্যাটাগরি আগে থেকেই আছে।' }, { status: 409 });
    }
    const category = await ExpenseCategory.create({ name });
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'ক্যাটাগরি যোগ করা যায়নি।' }, { status: 500 });
  }
}
