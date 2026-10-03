import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { secureStringEqual } from '@/lib/auth';
import { COURIER_NAMES, readCourierCredentials } from '@/lib/courier-credentials';
import Order from '@/models/Order';

const courierStatusMap: Record<string, string> = {
  pending: 'Pending (Courier)',
  booked: 'Pending (Courier)',
  picked_up: 'In Transit',
  'in transit': 'In Transit',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  partial_delivered: 'Partial Delivered',
  returned: 'Returned',
  lost: 'Lost',
  cancelled: 'Cancelled',
};

export async function POST(request: Request) {
  const secret = process.env.COURIER_WEBHOOK_SECRET || '';
  const provided = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || request.headers.get('x-webhook-secret') || '';
  const provider = request.headers.get('x-courier-provider') || '';
  if (secret && !secureStringEqual(provided, secret)) return NextResponse.json({ success: false, error: 'Unauthorized webhook.' }, { status: 401 });
  if (!secret) {
    if (!COURIER_NAMES.includes(provider as (typeof COURIER_NAMES)[number])) {
      return NextResponse.json({ success: false, error: 'Courier webhook token is not configured.' }, { status: 503 });
    }
    try {
      await connectDB();
      const credentials = await readCourierCredentials(provider as (typeof COURIER_NAMES)[number]);
      if (!credentials?.webhookToken) return NextResponse.json({ success: false, error: 'Courier webhook token is not configured.' }, { status: 503 });
      if (!secureStringEqual(provided, credentials.webhookToken)) return NextResponse.json({ success: false, error: 'Unauthorized webhook.' }, { status: 401 });
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Webhook authentication failed.' }, { status: 500 });
    }
  }

  try {
    const body = await request.json() as Record<string, unknown>;
    const orderId = String(body.orderId || body.merchant_order_id || body.invoice || '');
    const trackingId = String(body.trackingId || body.tracking_id || body.consignment_id || '');
    const courier = String(body.courier || body.courierName || '');
    const providerStatus = String(body.status || body.delivery_status || '').trim();
    const nextStatus = courierStatusMap[providerStatus.toLowerCase()];
    if ((!orderId && !trackingId) || !nextStatus) return NextResponse.json({ success: false, error: 'অর্ডার/ট্র্যাকিং আইডি বা status সঠিক নয়।' }, { status: 400 });

    if (!secret && courier !== provider) return NextResponse.json({ success: false, error: 'Webhook provider does not match the authenticated courier.' }, { status: 401 });
    await connectDB();
    const query = orderId && mongoose.isValidObjectId(orderId) ? { _id: orderId } : { trackingId };
    const order = await Order.findOne(query);
    if (!order) return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি।' }, { status: 404 });
    order.status = nextStatus;
    order.courierStatus = providerStatus;
    if (trackingId) order.trackingId = trackingId;
    if (courier) order.courierName = courier;
    order.activityLog.push({ action: 'Courier webhook', actor: courier || 'Courier', details: `Courier status: ${providerStatus}`, createdAt: new Date() });
    await order.save();
    return NextResponse.json({ success: true, data: { orderId: String(order._id), status: order.status, courierStatus: order.courierStatus } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Webhook update failed.' }, { status: 500 });
  }
}