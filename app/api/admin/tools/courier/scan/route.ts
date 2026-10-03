import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import { COURIER_NAMES } from '@/lib/courier-credentials';
import Order from '@/models/Order';

const statusMap = {
  shipping: { status: 'In Transit', courierStatus: 'Scanned for shipping' },
  return: { status: 'Returned', courierStatus: 'Scanned for return' },
} as const;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as { courier?: string; code?: string; direction?: string };
    const code = String(body.code || '').trim();
    const courier = String(body.courier || '');
    if (!code || code.length > 200 || !COURIER_NAMES.includes(courier as (typeof COURIER_NAMES)[number])
      || !body.direction || !(body.direction in statusMap)) {
      return NextResponse.json({ success: false, error: 'কুরিয়ার, barcode/invoice এবং shipping/return নির্বাচন করুন।' }, { status: 400 });
    }
    await connectDB();
    const query = mongoose.isValidObjectId(code)
      ? { $or: [{ _id: code }, { trackingId: code }] }
      : { trackingId: code };
    const order = await Order.findOne(query);
    if (!order) return NextResponse.json({ success: false, error: `“${code}” নম্বরের অর্ডার পাওয়া যায়নি।` }, { status: 404 });

    const update = statusMap[body.direction as keyof typeof statusMap];
    order.courierName = courier;
    if (code !== String(order._id)) order.trackingId ||= code;
    order.courierStatus = update.courierStatus;
    order.status = update.status;
    order.activityLog.push({
      action: 'Courier scan',
      actor: getAdminActor(request) || 'Admin',
      details: `${courier}: ${code} scanned for ${body.direction}`,
      createdAt: new Date(),
    });
    await order.save();
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'স্ক্যান আপডেট করা যায়নি।' }, { status: 500 });
  }
}
