import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import Expense from '@/models/Expense';
import ExpenseCategory from '@/models/ExpenseCategory';
import Order from '@/models/Order';

function parseDate(value: string | null, endOfDay = false) {
  if (!value) return null;
  const date = new Date(`${value}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const params = new URL(request.url).searchParams;
    const start = parseDate(params.get('start'));
    const end = parseDate(params.get('end'), true);
    if (params.has('start') && !start || params.has('end') && !end || start && end && start > end) {
      return NextResponse.json({ success: false, error: 'তারিখের পরিসর সঠিক নয়।' }, { status: 400 });
    }
    const range = start || end ? { $gte: start || new Date(0), $lte: end || new Date() } : undefined;
    await connectDB();
    const dateQuery = range ? { date: range } : {};
    const orderQuery = range ? { createdAt: range, status: { $in: ['Delivered', 'Partial Delivered'] } } : { status: { $in: ['Delivered', 'Partial Delivered'] } };
    const [categories, expenses, expenseSummary, incomeSummary] = await Promise.all([
      ExpenseCategory.find().sort({ name: 1 }).lean(),
      Expense.find(dateQuery).sort({ date: -1, createdAt: -1 }).limit(500).lean(),
      Expense.aggregate<{ _id: null; total: number }>([{ $match: dateQuery }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
      Order.aggregate<{ _id: null; total: number }>([{ $match: orderQuery }, { $group: { _id: null, total: { $sum: '$totalAmount' } } }]),
    ]);
    const income = incomeSummary[0]?.total || 0;
    const expense = expenseSummary[0]?.total || 0;
    return NextResponse.json({ success: true, data: { categories, expenses, income, expense, netBalance: income - expense } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'হিসাবের তথ্য লোড করা যায়নি।' }, { status: 500 });
  }
}
