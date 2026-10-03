import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import { COURIERS, dispatchCourier, type CourierName } from '@/lib/courier-adapter';
import Order from '@/models/Order';

export async function POST(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'অর্ডার আইডি সঠিক নয়।' }, { status: 400 });
    const body = await request.json() as { courier?: string };
    const courier = String(body.courier || '') as CourierName;
    if (!COURIERS.includes(courier)) return NextResponse.json({ success: false, error: 'Courier নির্বাচন করুন।' }, { status: 400 });
    await connectDB();
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি।' }, { status: 404 });
    if (order.trackingId) return NextResponse.json({ success: false, error: 'এই অর্ডারের tracking ID ইতিমধ্যে আছে।' }, { status: 409 });
    const address = [order.customerAddress, order.district, order.thana].filter(Boolean).join(', ');
    const result = await dispatchCourier(courier, {
      id: String(order._id),
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      address,
      totalAmount: Math.max(0, Number(order.totalAmount || 0) - Number(order.advancePayment?.amount || 0)),
      note: String(order.internalNote || ''),
    });
    const actor = getAdminActor(request) || 'Admin';
    order.courierName = courier;
    order.trackingId = result.trackingId;
    order.courierStatus = 'Booked';
    if (['Confirmed', 'Processing', 'Ready For Pickup'].includes(order.status)) order.status = 'Pending (Courier)';
    order.courierResponse = result.data;
    order.activityLog.push({ action: 'Courier dispatch', actor, details: `${courier} tracking ${result.trackingId}`, createdAt: new Date() });
    await order.save();
    return NextResponse.json({ success: true, data: order });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Courier dispatch failed.';
    return NextResponse.json({ success: false, error: message }, { status: message.includes('not configured') ? 503 : 502 });
  }
}