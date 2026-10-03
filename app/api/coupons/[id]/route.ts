import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Coupon from '@/models/Coupon';
import { requireAdmin } from '@/lib/auth-api';

type Context = { params: Promise<{ id: string }> | { id: string } };

function validate(body: Record<string, unknown>) {
  const code = String(body.code || '').trim().toUpperCase();
  const discountType = String(body.discountType || '');
  const discountValue = Number(body.discountValue);
  const maxDiscount = body.maxDiscount === '' || body.maxDiscount == null ? null : Number(body.maxDiscount);
  const minimumPurchase = Number(body.minimumPurchase ?? 0);
  const expiresAt = body.expiresAt ? new Date(String(body.expiresAt)) : null;
  if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !['percentage', 'amount'].includes(discountType) || !Number.isFinite(discountValue) || discountValue <= 0 || discountType === 'percentage' && discountValue > 100) {
    throw new Error('Coupon Code, Discount Type বা Value সঠিক নয়।');
  }
  if (maxDiscount !== null && (!Number.isFinite(maxDiscount) || maxDiscount < 0) || !Number.isFinite(minimumPurchase) || minimumPurchase < 0) throw new Error('Max Discount ও Minimum Purchase সঠিক নয়।');
  if (expiresAt && !Number.isFinite(expiresAt.getTime())) throw new Error('Expiry date সঠিক নয়।');
  if (typeof body.isActive !== 'boolean') throw new Error('Coupon Active status boolean হতে হবে।');
  return { code, discountType, discountValue, maxDiscount, minimumPurchase, expiresAt, isActive: body.isActive };
}

export async function PATCH(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Coupon ID সঠিক নয়।' }, { status: 400 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'কুপনের তথ্য সঠিক নয়।' }, { status: 400 });
    const updates = validate(body as Record<string, unknown>);
    await connectDB();
    const coupon = await Coupon.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!coupon) return NextResponse.json({ success: false, error: 'কুপন পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: coupon });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুপন আপডেট করা যায়নি।' }, { status: 400 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Coupon ID সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const coupon = await Coupon.findByIdAndDelete(id);
    if (!coupon) return NextResponse.json({ success: false, error: 'কুপন পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুপন মুছতে ব্যর্থ হয়েছে।' }, { status: 500 });
  }
}
