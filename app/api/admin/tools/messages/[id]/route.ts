import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import CustomerMessage from '@/models/CustomerMessage';

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'বার্তার আইডি সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const deleted = await CustomerMessage.findByIdAndDelete(id);
    if (!deleted) return NextResponse.json({ success: false, error: 'বার্তাটি পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'বার্তা মুছতে পারেনি।' }, { status: 500 });
  }
}
