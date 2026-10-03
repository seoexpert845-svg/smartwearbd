import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import Order, { ORDER_STATUSES } from '@/models/Order';
import Product from '@/models/Product';

type OrderItemInput = { productId?: string; name: string; price: number; quantity: number; imageUrl?: string; variant?: string; size?: string; buyingPrice?: number };

function jsonError(error: unknown, fallback: string) {
  return NextResponse.json({ success: false, error: error instanceof Error ? error.message : fallback }, { status: 500 });
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> | { id: string } }) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'অর্ডার আইডি সঠিক নয়।' }, { status: 400 });
    const payload: unknown = await request.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return NextResponse.json({ success: false, error: 'আপডেটের তথ্য সঠিক নয়।' }, { status: 400 });

    const body = payload as Record<string, unknown>;
    const actor = getAdminActor(request) || 'Admin';
    await connectDB();
    const order = await Order.findById(id);
    if (!order) return NextResponse.json({ success: false, error: 'অর্ডার পাওয়া যায়নি।' }, { status: 404 });

    const changes: string[] = [];
    if (body.status !== undefined) {
      const status = String(body.status);
      if (!ORDER_STATUSES.includes(status)) return NextResponse.json({ success: false, error: 'স্ট্যাটাস সঠিক নয়।' }, { status: 400 });
      order.status = status;
      order.isFake = status === 'Fake';
      changes.push(`Status: ${status}`);
    }

    const textFields = ['customerName', 'customerPhone', 'customerAddress', 'shippingAddress', 'district', 'thana', 'assignedStaff', 'courierName', 'courierStatus', 'trackingId', 'addressCorrection', 'source', 'internalNote'] as const;
    for (const field of textFields) {
      if (body[field] === undefined) continue;
      const value = String(body[field] || '').trim();
      if (['customerName', 'customerPhone', 'customerAddress', 'district', 'thana'].includes(field) && !value) {
        return NextResponse.json({ success: false, error: 'কাস্টমার ও ঠিকানার প্রয়োজনীয় তথ্য খালি রাখা যাবে না।' }, { status: 400 });
      }
      order.set(field, value);
      changes.push(`${field} updated`);
    }

    if (body.items !== undefined) {
      if (!Array.isArray(body.items)) return NextResponse.json({ success: false, error: 'পণ্যের তালিকা সঠিক নয়।' }, { status: 400 });
      const items = body.items.map((value): OrderItemInput | null => {
        if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
        const item = value as Record<string, unknown>;
        const name = String(item.name || '').trim();
        const price = Number(item.price);
        const quantity = Number(item.quantity);
        if (!name || !Number.isFinite(price) || price < 0 || !Number.isInteger(quantity) || quantity < 1) return null;
        return {
          productId: item.productId ? String(item.productId) : undefined,
          name,
          price,
          quantity,
          imageUrl: item.imageUrl ? String(item.imageUrl) : '',
          variant: item.variant ? String(item.variant) : '',
          size: item.size ? String(item.size) : '',
        };
      });
      if (!items.length || items.some((item) => !item)) return NextResponse.json({ success: false, error: 'অর্ডারে অন্তত একটি বৈধ পণ্য থাকতে হবে।' }, { status: 400 });
      const normalizedItems = items as OrderItemInput[];
      const oldItems = order.items as unknown as OrderItemInput[];
      const costByProduct = new Map(oldItems.filter((item) => item.productId && item.buyingPrice !== undefined).map((item) => [item.productId!, item.buyingPrice!]));
      const productIds = [...new Set(normalizedItems.flatMap((item) => item.productId && !costByProduct.has(item.productId) ? [item.productId] : []))];
      const currentProducts = productIds.length ? await Product.find({ _id: { $in: productIds } }).select('+buyingPrice').lean() : [];
      const currentCostByProduct = new Map(currentProducts.map((product) => [String(product._id), Number(product.buyingPrice || 0)]));
      normalizedItems.forEach((item) => {
        if (item.productId) item.buyingPrice = costByProduct.get(item.productId) ?? currentCostByProduct.get(item.productId);
      });
      order.items = normalizedItems;
      changes.push('Items modified');
    }

    if (body.shippingFee !== undefined) {
      const fee = Number(body.shippingFee);
      if (!Number.isFinite(fee) || fee < 0) return NextResponse.json({ success: false, error: 'ডেলিভারি চার্জ সঠিক নয়।' }, { status: 400 });
      order.shippingFee = fee;
      changes.push(`Shipping fee: ${fee}`);
    }
    if (body.discountType !== undefined) {
      const discountType = String(body.discountType);
      if (!['flat', 'percentage'].includes(discountType)) return NextResponse.json({ success: false, error: 'ডিসকাউন্টের ধরন সঠিক নয়।' }, { status: 400 });
      order.discountType = discountType;
    }
    if (body.discountValue !== undefined || body.discountAmount !== undefined) {
      const value = Number(body.discountValue ?? body.discountAmount);
      if (!Number.isFinite(value) || value < 0) return NextResponse.json({ success: false, error: 'ডিসকাউন্ট সঠিক নয়।' }, { status: 400 });
      if (body.discountAmount !== undefined && body.discountValue === undefined) {
        order.discountType = 'flat';
        order.discountValue = value;
      } else order.discountValue = value;
      changes.push(`Discount: ${value}`);
    }
    if (body.taxAmount !== undefined) {
      const tax = Number(body.taxAmount);
      if (!Number.isFinite(tax) || tax < 0) return NextResponse.json({ success: false, error: 'ট্যাক্সের পরিমাণ সঠিক নয়।' }, { status: 400 });
      order.taxAmount = tax;
    }
    if (body.paymentMethod !== undefined) order.paymentMethod = String(body.paymentMethod).trim();

    if (body.advancePayment !== undefined) {
      if (!body.advancePayment || typeof body.advancePayment !== 'object' || Array.isArray(body.advancePayment)) return NextResponse.json({ success: false, error: 'অগ্রিম পেমেন্টের তথ্য সঠিক নয়।' }, { status: 400 });
      const advance = body.advancePayment as Record<string, unknown>;
      const amount = Number(advance.amount);
      const gateway = String(advance.gateway || '');
      if (!Number.isFinite(amount) || amount < 0 || amount > Number(order.totalAmount || 0) || !['', 'bKash', 'Nagad', 'Rocket'].includes(gateway)) {
        return NextResponse.json({ success: false, error: 'অগ্রিম পেমেন্টের পরিমাণ বা গেটওয়ে সঠিক নয়।' }, { status: 400 });
      }
      order.advancePayment = {
        amount,
        gateway,
        transactionId: String(advance.transactionId || '').trim(),
        receivedBy: actor,
        receivedAt: amount > 0 ? new Date() : undefined,
      };
      changes.push(`Advance payment recorded: ${amount} ${gateway}`);
    }

    const subtotal = (order.items as { price?: number; quantity?: number }[]).reduce((sum: number, item: { price?: number; quantity?: number }) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
    const discountValue = Number(order.discountValue || order.discountAmount || 0);
    const discountAmount = order.discountType === 'percentage'
      ? Math.min(subtotal, subtotal * Math.min(discountValue, 100) / 100)
      : Math.min(subtotal, discountValue);
    order.discountAmount = discountAmount;
    order.totalAmount = Math.max(0, subtotal + Number(order.shippingFee || 0) + Number(order.taxAmount || 0) - discountAmount);

    if (!changes.length) return NextResponse.json({ success: false, error: 'কোনো পরিবর্তন পাওয়া যায়নি।' }, { status: 400 });
    for (const details of changes) order.activityLog.push({ action: details.split(':')[0], actor, details, createdAt: new Date() });
    await order.save();
    return NextResponse.json({ success: true, data: order }, { status: 200 });
  } catch (error) {
    return jsonError(error, 'অর্ডার আপডেট করা যায়নি।');
  }
}