import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import { COURIERS, dispatchCourier, type CourierName } from '@/lib/courier-adapter';
import Order, { ORDER_STATUSES } from '@/models/Order';

const SMS_API_URL = process.env.SMS_API_URL;
const SMS_API_KEY = process.env.SMS_API_KEY;

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ success: false, error: 'অ্যাকশনের তথ্য সঠিক নয়।' }, { status: 400 });
    const body = payload as Record<string, unknown>;
    const ids = Array.isArray(body.orderIds) ? body.orderIds.map(String) : [];
    const action = String(body.action || '');
    if (!ids.length || ids.length > 100 || ids.some((id) => !mongoose.isValidObjectId(id))) return NextResponse.json({ success: false, error: '১ থেকে ১০০টি বৈধ অর্ডার নির্বাচন করুন।' }, { status: 400 });

    await connectDB();
    const orders = await Order.find({ _id: { $in: ids } });
    if (!orders.length) return NextResponse.json({ success: false, error: 'নির্বাচিত অর্ডার পাওয়া যায়নি।' }, { status: 404 });
    const actor = getAdminActor(request) || 'Admin';

    if (action === 'dispatchCourier') {
      const courier = String(body.value || '') as CourierName;
      if (!COURIERS.includes(courier)) return NextResponse.json({ success: false, error: 'Courier নির্বাচন করুন।' }, { status: 400 });
      const updated = [];
      const failures: { id: string; error: string }[] = [];
      for (const order of orders) {
        if (order.trackingId) { failures.push({ id: String(order._id), error: 'Tracking ID আগে থেকেই আছে।' }); continue; }
        try {
          const result = await dispatchCourier(courier, {
            id: String(order._id),
            customerName: order.customerName,
            customerPhone: order.customerPhone,
            address: [order.customerAddress, order.district, order.thana].filter(Boolean).join(', '),
            totalAmount: Math.max(0, Number(order.totalAmount || 0) - Number(order.advancePayment?.amount || 0)),
            note: String(order.internalNote || ''),
          });
          order.courierName = courier;
          order.courierStatus = 'Booked';
          order.trackingId = result.trackingId;
          order.courierResponse = result.data;
          if (['Confirmed', 'Processing', 'Ready For Pickup'].includes(order.status)) order.status = 'Pending (Courier)';
          order.activityLog.push({ action: 'Courier dispatch', actor, details: `${courier} tracking ${result.trackingId}`, createdAt: new Date() });
          await order.save();
          updated.push(order);
        } catch (error) {
          failures.push({ id: String(order._id), error: error instanceof Error ? error.message : 'Dispatch failed' });
        }
      }
      return NextResponse.json({ success: updated.length > 0, updated: updated.length, failures, data: updated }, { status: updated.length ? 200 : 502 });
    }

    if (action === 'sms') {
      const message = String(body.message || '').trim();
      if (!message || message.length > 500) return NextResponse.json({ success: false, error: '১ থেকে ৫০০ অক্ষরের SMS লিখুন।' }, { status: 400 });
      if (!SMS_API_URL || !SMS_API_KEY) return NextResponse.json({ success: false, error: 'SMS provider কনফিগার করা নেই। SMS_API_URL ও SMS_API_KEY সেট করুন।' }, { status: 503 });
      const recipients = orders.map((order) => ({ to: order.customerPhone, orderId: String(order._id) })).filter((recipient) => recipient.to);
      const response = await fetch(SMS_API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${SMS_API_KEY}` },
        body: JSON.stringify({ recipients, message }),
      });
      if (!response.ok) return NextResponse.json({ success: false, error: `SMS provider ব্যর্থ হয়েছে (${response.status})।` }, { status: 502 });
      for (const order of orders) {
        order.activityLog.push({ action: 'SMS sent', actor, details: `Bulk SMS sent to ${order.customerPhone}`, createdAt: new Date() });
        await order.save();
      }
      return NextResponse.json({ success: true, updated: orders.length, data: await response.json() });
    }

    const value = String(body.value || '').trim();
    if (action === 'status' && !ORDER_STATUSES.includes(value)) return NextResponse.json({ success: false, error: 'স্ট্যাটাস সঠিক নয়।' }, { status: 400 });
    if (!['status', 'assignStaff', 'assignCourier', 'fake'].includes(action)) return NextResponse.json({ success: false, error: 'এই bulk action সমর্থিত নয়।' }, { status: 400 });
    if (['assignStaff', 'assignCourier'].includes(action) && !value) return NextResponse.json({ success: false, error: 'একটি মান নির্বাচন করুন।' }, { status: 400 });

    for (const order of orders) {
      let details = '';
      if (action === 'status') {
        order.status = value;
        order.isFake = value === 'Fake';
        details = `Status changed to ${value}`;
      } else if (action === 'assignStaff') {
        order.assignedStaff = value;
        details = `Assigned to ${value}`;
      } else if (action === 'assignCourier') {
        order.courierName = value;
        details = `Courier assigned: ${value}`;
      } else {
        order.isFake = true;
        order.status = 'Fake';
        details = 'Order flagged as fake';
      }
      order.activityLog.push({ action, actor, details, createdAt: new Date() });
      await order.save();
    }
    return NextResponse.json({ success: true, updated: orders.length, data: orders });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Bulk action ব্যর্থ হয়েছে।' }, { status: 500 });
  }
}