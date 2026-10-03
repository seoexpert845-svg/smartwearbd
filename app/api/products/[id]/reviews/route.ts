import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import Product from '@/models/Product';
import ProductReview from '@/models/ProductReview';
import Order from '@/models/Order';
import User from '@/models/User';

type Context = { params: Promise<{ id: string }> | { id: string } };

export async function GET(_request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'পণ্যের আইডি সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const data = await ProductReview.find({ productId: id, status: 'Approved' })
      .select('reviewerName rating text imageUrl verifiedBuyer createdAt')
      .sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'রিভিউ লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'পণ্যের আইডি সঠিক নয়।' }, { status: 400 });
    const token = request.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const session = verifySession(token);
    if (!session || session.role !== 'user') return NextResponse.json({ success: false, error: 'রিভিউ দিতে আগে গ্রাহক অ্যাকাউন্টে সাইন ইন করুন।' }, { status: 401 });
    const body = await request.json() as { rating?: unknown; text?: unknown; imageUrl?: unknown };
    const rating = Number(body.rating);
    const text = String(body.text || '').trim();
    if (!Number.isInteger(rating) || rating < 1 || rating > 5 || text.length < 3 || text.length > 3000) {
      return NextResponse.json({ success: false, error: '১–৫ স্টার রেটিং এবং ৩–৩০০০ অক্ষরের রিভিউ লিখুন।' }, { status: 400 });
    }

    await connectDB();
    const [user, product] = await Promise.all([
      User.findById(session.sub).select('name phone role').lean(),
      Product.findById(id).select('name isPublic').lean(),
    ]);
    if (!user || user.role !== 'user') return NextResponse.json({ success: false, error: 'গ্রাহক অ্যাকাউন্ট পাওয়া যায়নি।' }, { status: 401 });
    if (!product || product.isPublic === false) return NextResponse.json({ success: false, error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    const deliveredOrder = await Order.exists({ status: 'Delivered', 'items.productId': id, userId: session.sub });
    if (!deliveredOrder) return NextResponse.json({ success: false, error: 'শুধু ডেলিভার্ড অর্ডারের verified buyer রিভিউ দিতে পারবেন।' }, { status: 403 });
    if (await ProductReview.exists({ productId: id, userId: session.sub })) return NextResponse.json({ success: false, error: 'এই পণ্যে আপনার রিভিউ আগে থেকেই আছে।' }, { status: 409 });

    const review = await ProductReview.create({
      productId: id, productName: product.name, userId: session.sub, reviewerName: user.name,
      phone: user.phone || '', rating, text, imageUrl: String(body.imageUrl || ''),
      status: 'Pending', verifiedBuyer: true, createdByAdmin: false,
    });
    return NextResponse.json({ success: true, data: review }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) {
      return NextResponse.json({ success: false, error: 'এই পণ্যে আপনার রিভিউ আগে থেকেই আছে।' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'রিভিউ জমা দেওয়া যায়নি।' }, { status: 500 });
  }
}
