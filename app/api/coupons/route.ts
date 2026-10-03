import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Coupon from '@/models/Coupon';
import { requireAdmin } from '@/lib/auth-api';

function normalizedCoupon(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toUpperCase();
  const discountType = String(body.discountType || '');
  const discountValue = Number(body.discountValue);
  const maxDiscount = body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount);
  const minimumPurchase = Number(body.minimumPurchase ?? 0);
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
  const isActive = body.isActive === true;
  if (!/^[A-Z0-9_-]{3,40}$/.test(code)) throw new Error('কুপন কোডে ৩–৪০টি অক্ষর, সংখ্যা, _ অথবা - ব্যবহার করুন।');
  if (!['percentage', 'amount'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || discountType === 'percentage' && discountValue > 100) {
    throw new Error('Discount type বা value সঠিক নয়। Percentage ১০০-এর বেশি হতে পারবে না।');
  }
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0) || !Number.isFinite(minimumPurchase) || minimumPurchase < 0) {
    throw new Error('Max Discount ও Minimum Purchase শূন্য বা তার বেশি হতে হবে।');
  }
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) throw new Error('Expiry date সঠিক নয়।');
  return { code, discountType, discountValue, maxDiscount, minimumPurchase, expiresAt, isActive };
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const data = await Coupon.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুপন লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'কুপনের তথ্য সঠিক নয়।' }, { status: 400 });
    const coupon = normalizedCoupon(body as Record<string, unknown>);
    await connectDB();
    const created = await Coupon.create(coupon);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('Duplicate key')) return NextResponse.json({ success: false, error: 'এই Coupon Code আগে থেকেই আছে।' }, { status: 409 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুপন তৈরি করা যায়নি।' }, { status: 400 });
  }
}
