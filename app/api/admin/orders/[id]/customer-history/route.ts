import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import Order from '@/models/Order';

export async function GET(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'অর্ডার আইডি সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const order = await Order.findById(id).select('customerPhone').lean();
    if (!order?.customerPhone) return NextResponse.json({ success: true, data: { orders: [], totalOrders: 0, totalSpent: 0, delivered: 0, returned: 0, cancelled: 0, successRate: 0 } });
    const history = await Order.find({ customerPhone: order.customerPhone }).sort({ createdAt: -1 }).select('status totalAmount createdAt items').lean();
    const delivered = history.filter((item) => item.status === 'Delivered' || item.status === 'Partial Delivered').length;
    const returned = history.filter((item) => item.status === 'Returned' || item.status === 'Lost').length;
    const cancelled = history.filter((item) => item.status === 'Cancelled' || item.status === 'Fake').length;
    return NextResponse.json({
      success: true,
      data: {
        orders: history.slice(0, 8).map((item) => ({ id: String(item._id), status: item.status, totalAmount: Number(item.totalAmount || 0), createdAt: item.createdAt, itemCount: item.items?.length || 0 })),
        totalOrders: history.length,
        totalSpent: history.filter((item) => item.status === 'Delivered' || item.status === 'Partial Delivered').reduce((sum, item) => sum + Number(item.totalAmount || 0), 0),
        delivered,
        returned,
        cancelled,
        successRate: history.length ? Math.round(delivered / history.length * 100) : 0,
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কাস্টমার হিস্ট্রি লোড করা যায়নি।' }, { status: 500 });
  }
}