import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import ProductSection from '@/models/ProductSection';

export async function GET() {
  try {
    await connectDB();
    const data = await ProductSection.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সেকশন লোড করা যায়নি।' }, { status: 500 });
  }
}
