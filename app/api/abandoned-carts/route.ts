import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import AbandonedCart from '@/models/AbandonedCart';

export async function POST(request: Request) {
  try {
    const body = await request.json() as Record<string, unknown>;
    const sessionId = String(body.sessionId || '').trim();
    if (!/^[\w-]{16,100}$/.test(sessionId)) return NextResponse.json({ success: false, error: 'Cart session সঠিক নয়।' }, { status: 400 });
    const items = Array.isArray(body.items) ? body.items.slice(0, 50).map((value) => {
      if (!value || typeof value !== 'object') return null;
      const item = value as Record<string, unknown>;
      return { productId: String(item.productId || ''), name: String(item.name || '').slice(0, 160), price: Math.max(0, Number(item.price || 0)), quantity: Math.max(1, Math.min(99, Number(item.quantity || 1))), imageUrl: String(item.imageUrl || '').slice(0, 500) };
    }).filter((item) => item?.name) : [];
    if (!items.length) return NextResponse.json({ success: true, skipped: true });
    const stage = body.stage === 'checkout' ? 'checkout' : 'cart';
    await connectDB();
    const cart = await AbandonedCart.findOneAndUpdate({ sessionId }, {
      $set: {
        customerName: String(body.customerName || '').slice(0, 120),
        customerPhone: String(body.customerPhone || '').replace(/\D/g, '').slice(0, 14),
        userEmail: String(body.userEmail || '').slice(0, 180),
        district: String(body.district || '').slice(0, 80),
        thana: String(body.thana || '').slice(0, 100),
        customerAddress: String(body.customerAddress || '').slice(0, 500),
        items,
        stage,
      },
      $setOnInsert: { sessionId },
    }, { new: true, upsert: true, runValidators: true });
    return NextResponse.json({ success: true, data: { id: String(cart._id), updatedAt: cart.updatedAt } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Cart save করা যায়নি।' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const incomplete = await AbandonedCart.find({ convertedAt: { $exists: false }, updatedAt: { $gte: new Date(Date.now() - 30 * 86_400_000) } }).sort({ updatedAt: -1 }).limit(500).lean();
    return NextResponse.json({ success: true, data: incomplete.map((cart) => ({
      _id: String(cart._id),
      customerName: cart.customerName || 'নাম অসম্পূর্ণ',
      customerPhone: cart.customerPhone || '',
      customerAddress: cart.customerAddress || '',
      shippingAddress: cart.customerAddress || '',
      district: cart.district || '',
      thana: cart.thana || '',
      userEmail: cart.userEmail || '',
      items: cart.items || [],
      totalAmount: ((cart.items || []) as { price?: number; quantity?: number }[]).reduce((sum: number, item: { price?: number; quantity?: number }) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0),
      status: 'Incomplete',
      source: 'Website',
      isAbandonedCart: true,
      cartSessionId: cart.sessionId,
      createdAt: cart.createdAt,
    })) });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Incomplete carts লোড করা যায়নি।' }, { status: 500 });
  }
}