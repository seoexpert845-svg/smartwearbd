import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Category from '@/models/Category';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth-api';

type CategoryRouteContext = { params: Promise<{ id: string }> | { id: string } };

function errorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : String(error) || fallback;
  return NextResponse.json({ success: false, message, error: message }, { status: 500 });
}

export async function PATCH(request: Request, context: CategoryRouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'ক্যাটাগরি আইডি সঠিক নয়।' }, { status: 400 });
    const body = await request.json();
    const name = String(body.name || '').trim();
    if (!name) return NextResponse.json({ success: false, error: 'ক্যাটাগরির নাম প্রয়োজন।' }, { status: 400 });

    await connectDB();
    const current = await Category.findById(id);
    if (!current) return NextResponse.json({ success: false, error: 'ক্যাটাগরিটি পাওয়া যায়নি।' }, { status: 404 });
    const duplicate = await Category.findOne({ name, _id: { $ne: id } }).lean();
    if (duplicate) return NextResponse.json({ success: false, error: 'এই নামে আরেকটি ক্যাটাগরি আছে।' }, { status: 409 });

    const previousName = current.name;
    current.name = name;
    if (body.description !== undefined) current.description = String(body.description).trim();
    if (body.imageUrl !== undefined) current.imageUrl = String(body.imageUrl).trim();
    if (body.parentCategory !== undefined) {
      const parentCategory = String(body.parentCategory || '').trim();
      if (parentCategory && (!await Category.exists({ name: parentCategory, $or: [{ parentCategory: '' }, { parentCategory: { $exists: false } }] }) || parentCategory === current.name)) {
        return NextResponse.json({ success: false, error: 'মূল ক্যাটাগরিটি সঠিক নয়।' }, { status: 400 });
      }
      current.parentCategory = parentCategory;
    }
    await current.save();
    if (previousName !== name) {
      await Promise.all([
        Product.updateMany({ category: previousName }, { $set: { category: name } }),
        Category.updateMany({ parentCategory: previousName }, { $set: { parentCategory: name } }),
      ]);
    }
    return NextResponse.json({ success: true, data: current });
  } catch (error) {
    console.error('Category Update Error:', error);
    return errorResponse(error, 'ক্যাটাগরি আপডেট করা যায়নি।');
  }
}

export async function DELETE(_request: Request, context: CategoryRouteContext) {
  const unauthorized = requireAdmin(_request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'ক্যাটাগরি আইডি সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const category = await Category.findById(id);
    if (!category) return NextResponse.json({ success: false, error: 'ক্যাটাগরিটি পাওয়া যায়নি।' }, { status: 404 });
    const [productCount, childCount] = await Promise.all([
      Product.countDocuments({ $or: [{ category: category.name }, { subCategory: category.name }] }),
      Category.countDocuments({ parentCategory: category.name }),
    ]);
    if (productCount > 0) return NextResponse.json({ success: false, error: `এই ক্যাটাগরিতে ${productCount}টি পণ্য রয়েছে। আগে পণ্যগুলো অন্য ক্যাটাগরিতে নিন।` }, { status: 409 });
    if (childCount > 0) return NextResponse.json({ success: false, error: `এই ক্যাটাগরির ${childCount}টি সাব-ক্যাটাগরি আছে। আগে সেগুলো সরান।` }, { status: 409 });
    await category.deleteOne();
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return errorResponse(error, 'ক্যাটাগরি মুছে ফেলা যায়নি।');
  }
}