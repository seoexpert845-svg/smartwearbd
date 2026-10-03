import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Coupon from '@/models/Coupon';

export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'কুপনের তথ্য সঠিক নয়।' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const code = String(input.code || '').trim().toUpperCase();
    const subtotal = Number(input.subtotal);
    if (!/^[A-Z0-9_-]{3,40}$/.test(code) || !Number.isFinite(subtotal) || subtotal < 0) return NextResponse.json({ success: false, error: 'কুপন কোড বা অর্ডারের পরিমাণ সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const coupon = await Coupon.findOne({ code, isActive: true }).lean();
    if (!coupon || coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) return NextResponse.json({ success: false, error: 'কুপনটি পাওয়া যায়নি, নিষ্ক্রিয় বা মেয়াদোত্তীর্ণ।' }, { status: 404 });
    if (subtotal < coupon.minimumPurchase) return NextResponse.json({ success: false, error: `এই কুপনের জন্য সর্বনিম্ন ক্রয় ৳${coupon.minimumPurchase} হতে হবে।` }, { status: 400 });
    const discount = Math.min(subtotal, coupon.discountType === 'percentage' ? subtotal * coupon.discountValue / 100 : coupon.discountValue, coupon.maxDiscount ?? Number.POSITIVE_INFINITY);
    return NextResponse.json({ success: true, data: { code: coupon.code, discount: Math.round(discount * 100) / 100, discountType: coupon.discountType, discountValue: coupon.discountValue } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুপন যাচাই করা যায়নি।' }, { status: 500 });
  }
}
