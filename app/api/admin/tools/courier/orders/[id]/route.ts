import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import Order from '@/models/Order';

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'অর্ডার আইডি সঠিক নয়।' }, { status: 400 });
    const body = await request.json() as { courierPaymentStatus?: string; courierCollectedAmount?: number };
    if (body.courierPaymentStatus !== undefined && !['Paid', 'Unpaid'].includes(body.courierPaymentStatus)) {
      return NextResponse.json({ success: false, error: 'পেমেন্ট স্ট্যাটাস সঠিক নয়।' }, { status: 400 });
    }
    if (body.courierCollectedAmount !== undefined && (!Number.isFinite(body.courierCollectedAmount) || body.courierCollectedAmount < 0 || body.courierCollectedAmount > 100_000_000)) {
      return NextResponse.json({ success: false, error: 'সংগৃহীত অর্থের পরিমাণ সঠিক নয়।' }, { status: 400 });
    }
    if (body.courierPaymentStatus === undefined && body.courierCollectedAmount === undefined) {
      return NextResponse.json({ success: false, error: 'আপডেট করার পেমেন্ট তথ্য দিন।' }, { status: 400 });
    }
    await connectDB();
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি।' }, { status: 404 });
    if (body.courierPaymentStatus !== undefined) order.courierPaymentStatus = body.courierPaymentStatus;
    if (body.courierCollectedAmount !== undefined) order.courierCollectedAmount = body.courierCollectedAmount;
    order.activityLog.push({
      action: 'Courier payment update',
      actor: getAdminActor(request) || 'Admin',
      details: `Courier payment ${order.courierPaymentStatus}: ${order.courierCollectedAmount}`,
      createdAt: new Date(),
    });
    await order.save();
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুরিয়ার পেমেন্ট আপডেট করা যায়নি।' }, { status: 500 });
  }
}
