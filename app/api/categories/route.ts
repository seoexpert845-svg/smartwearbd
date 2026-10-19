import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth-api';

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error) || fallback;
  return NextResponse.json({ success: false, message, error: message }, { status: 500 });
}

export async function GET() {
  try {
    await connectDB();
    const productCategories = await Product.distinct('category');
    await Promise.all(productCategories
      .filter((name): name is string => typeof name === 'string' && Boolean(name.trim()))
      .map((name) => Category.updateOne({ name: name.trim() }, { $setOnInsert: { name: name.trim() } }, { upsert: true })));
    const categories = await Category.find({}).sort({ name: 1 }).lean();
    const counts = await Product.aggregate<{ _id: string; count: number }>([
      { $group: { _id: '$category', count: { $sum: 1 } } },
    ]);
    const countByName = new Map(counts.map((entry) => [entry._id, entry.count]));
    return NextResponse.json({ success: true, data: categories.map((category) => ({ ...category, productCount: countByName.get(category.name) || 0 })) });
  } catch (error) {
    return errorResponse(error, 'ক্যাটাগরি লোড করা যায়নি।');
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ success: false, error: 'ক্যাটাগরির নাম প্রয়োজন।' }, { status: 400 });

    await connectDB();
    const existing = await Category.findOne({ name }).lean();
    if (existing) return NextResponse.json({ success: false, error: 'এই ক্যাটাগরিটি আগে থেকেই আছে।' }, { status: 409 });

    const parentCategory = String(body.parentCategory || '').trim();
    if (parentCategory && !await Category.exists({ name: parentCategory, $or: [{ parentCategory: '' }, { parentCategory: { $exists: false } }] })) {
      return NextResponse.json({ success: false, error: 'সাব-ক্যাটাগরির মূল ক্যাটাগরি পাওয়া যায়নি।' }, { status: 400 });
    }
    const category = await Category.create({ name, parentCategory, description: String(body.description || '').trim(), imageUrl: String(body.imageUrl || '').trim() });
    return NextResponse.json({ success: true, data: category }, { status: 201 });
  } catch (error) {
    console.error('Category Creation Error:', error);
    return errorResponse(error, 'ক্যাটাগরি তৈরি করা যায়নি।');
  }
}