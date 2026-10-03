import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import Expense from '@/models/Expense';
import ExpenseCategory from '@/models/ExpenseCategory';

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { categoryId?: string; amount?: number; date?: string; note?: string };
    const amount = Number(body.amount);
    const date = body.date ? new Date(body.date) : new Date();
    if (!mongoose.isValidObjectId(body.categoryId) || !Number.isFinite(amount) || amount <= 0 || amount > 100_000_000
      || Number.isNaN(date.getTime()) || date > new Date() || String(body.note || '').length > 1000) {
      return NextResponse.json({ success: false, error: 'ক্যাটাগরি, সঠিক পরিমাণ, তারিখ এবং সর্বোচ্চ ১,০০০ অক্ষরের নোট দিন।' }, { status: 400 });
    }
    await connectDB();
    const category = await ExpenseCategory.findById(body.categoryId).lean();
    if (!category) return NextResponse.json({ success: false, error: 'খরচের ক্যাটাগরি পাওয়া যায়নি।' }, { status: 404 });
    const expense = await Expense.create({ categoryId: category._id, categoryName: category.name, amount, date, note: String(body.note || '').trim() });
    return NextResponse.json({ success: true, data: expense }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'খরচ যোগ করা যায়নি।' }, { status: 500 });
  }
}
