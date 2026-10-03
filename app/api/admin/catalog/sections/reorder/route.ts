import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import ProductSection from '@/models/ProductSection';

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { ids?: unknown };
    if (!Array.isArray(body.ids) || body.ids.some((id) => typeof id !== 'string' || !mongoose.isValidObjectId(id)) || new Set(body.ids).size !== body.ids.length) {
      return NextResponse.json({ success: false, error: 'সেকশনের ক্রম সঠিক নয়।' }, { status: 400 });
    }
    await connectDB();
    await Promise.all(body.ids.map((id, sortOrder) => ProductSection.updateOne({ _id: id }, { $set: { sortOrder } })));
    return NextResponse.json({ success: true, data: { updated: body.ids.length } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সেকশনের ক্রম সংরক্ষণ করা যায়নি।' }, { status: 500 });
  }
}
