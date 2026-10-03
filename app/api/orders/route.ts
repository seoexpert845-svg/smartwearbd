import connectDB from '@/lib/db';
import Order from '@/models/Order';
import BlockedCustomer from '@/models/BlockedCustomer';
import AbandonedCart from '@/models/AbandonedCart';
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-api';
import { resolveClientIp } from '@/lib/client-ip';
import Product from '@/models/Product';
import SiteSetting from '@/models/SiteSetting';
import Coupon from '@/models/Coupon';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';

type NormalizedItem = {
  productId?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  variant?: string;
  size?: string;
  buyingPrice?: number;
};
type OrderVariant = { attributes: Record<string, string>; stock: number; price?: number };

const BD_PHONE_PATTERN = /^01[3-9]\d{8}$/;
const ORDER_SOURCES = ['Website', 'Landing Page', 'Direct Order', 'App', 'WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Google'] as const;

export async function POST(req: Request) {
  try {
    const payload: unknown = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ success: false, error: 'অর্ডারের তথ্য সঠিক নয়।' }, { status: 400 });
    }

    const body = payload as Record<string, unknown>;
    const customerName = String(body.customerName || body.name || '').trim();
    const customerPhone = String(body.customerPhone || body.phone || '').trim();
    const customerAddress = String(body.customerAddress || body.shippingAddress || body.address || '').trim();
    const shippingAddress = String(body.shippingAddress || customerAddress).trim();
    const userEmail = String(body.userEmail || body.email || 'guest@example.com').trim().toLowerCase();
    const district = String(body.district || '').trim();
    const thana = String(body.thana || '').trim();
    const requestedSource = String(body.source || 'Website').trim();
    const cartSessionId = String(body.cartSessionId || '').trim();
    const adminRequest = requireAdmin(req) === null;
    const source = adminRequest && ORDER_SOURCES.includes(requestedSource as (typeof ORDER_SOURCES)[number]) ? requestedSource : 'Website';
    const assignedStaff = adminRequest ? String(body.assignedStaff || '').trim() : '';
    const items: unknown[] = Array.isArray(body.items) ? body.items : [];

    if (!customerName || !customerAddress || !shippingAddress || !district || !thana || !userEmail || !BD_PHONE_PATTERN.test(customerPhone) || items.length === 0 || items.some((item) => !item || typeof item !== 'object' || Array.isArray(item))) {
      return NextResponse.json(
        { success: false, error: 'নাম, ঠিকানা, জেলা, উপজেলা, বৈধ ১১ সংখ্যার ফোন নম্বর এবং অন্তত একটি পণ্য প্রয়োজন।' },
        { status: 400 }
      );
    }

    const normalizedItems: NormalizedItem[] = items.map((value) => {
      const item = value as Record<string, unknown>;
      return {
        productId: item.productId ? String(item.productId) : undefined,
        name: String(item.name || '').trim(),
        price: Number(item.price),
        quantity: Number(item.quantity),
        imageUrl: item.imageUrl ? String(item.imageUrl) : '',
        variant: item.variant ? String(item.variant).trim() : undefined,
        size: item.size ? String(item.size).trim() : undefined,
      };
    });

    if (normalizedItems.some((item) => !item.name || !Number.isFinite(item.price) || item.price < 0 || !Number.isInteger(item.quantity) || item.quantity < 1)) {
      return NextResponse.json({ success: false, error: 'পণ্যের তথ্য সঠিক নয়।' }, { status: 400 });
    }

    const customerIp = await resolveClientIp(req);
    const couponCode = String(body.couponCode || '').trim().toUpperCase();
    const sessionToken = req.headers.get('cookie')?.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`))?.slice(SESSION_COOKIE.length + 1);
    const session = verifySession(sessionToken);
    const userId = session?.role === 'user' ? session.sub : undefined;

    await connectDB();
    const storeSettings = await SiteSetting.findOne({ key: 'store' }).select('orderSettings').lean();
    const orderSettings = storeSettings?.orderSettings as { duplicateOrderBlock?: boolean; duplicateBlockMinutes?: number } | undefined;
    if (!adminRequest && orderSettings?.duplicateOrderBlock) {
      const cutoff = new Date(Date.now() - Math.max(1, Number(orderSettings.duplicateBlockMinutes) || 30) * 60_000);
      const duplicate = await Order.findOne({ customerPhone, createdAt: { $gte: cutoff }, status: { $nin: ['Cancelled', 'Returned'] } }).select('_id').lean();
      if (duplicate) return NextResponse.json({ success: false, error: 'এই ফোন নম্বর থেকে সাম্প্রতিক একটি অর্ডার পাওয়া গেছে। কিছুক্ষণ পর আবার চেষ্টা করুন।' }, { status: 409 });
    }
    const identifiedItems = normalizedItems.filter((item) => item.productId);
    if (!adminRequest && identifiedItems.length !== normalizedItems.length) {
      return NextResponse.json({ success: false, error: 'কার্টের পণ্যের তথ্য যাচাই করা যায়নি।' }, { status: 400 });
    }
    const productIds = [...new Set(identifiedItems.map((item) => item.productId!))];
    const products = productIds.length ? await Product.find({ _id: { $in: productIds } }).select('+buyingPrice') : [];
    const productById = new Map(products.map((product) => [String(product._id), product]));
    const requestedByVariant = new Map<string, number>();
    const requestedByProduct = new Map<string, number>();
    for (const item of normalizedItems) {
      if (!item.productId) continue;
      const product = productById.get(item.productId);
      if (!product || product.isPublic === false || product.inStock === false) {
        return NextResponse.json({ success: false, error: `“${item.name}” পণ্যটি বর্তমানে পর্যাপ্ত স্টকে নেই।` }, { status: 409 });
      }
      let chosenVariant: OrderVariant | undefined;
      if (product.productType === 'variant') {
        let requestedAttributes: Record<string, string> = {};
        try {
          const parsed: unknown = JSON.parse(item.variant || '');
          if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Invalid attributes');
          requestedAttributes = Object.fromEntries(Object.entries(parsed).map(([key, value]) => [key, String(value)]));
        } catch {
          return NextResponse.json({ success: false, error: `“${item.name}” পণ্যের ভ্যারিয়েন্ট নির্বাচন করুন।` }, { status: 400 });
        }
        const attributeKey = (value: Record<string, string>) => JSON.stringify(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)));
        const variants = product.variants as OrderVariant[];
        chosenVariant = variants.find((candidate: OrderVariant) => attributeKey(candidate.attributes) === attributeKey(requestedAttributes));
        if (!chosenVariant) return NextResponse.json({ success: false, error: `“${item.name}” পণ্যের নির্বাচিত ভ্যারিয়েন্ট পাওয়া যায়নি।` }, { status: 400 });
        item.variant = JSON.stringify(chosenVariant.attributes);
      }
      const availableStock = chosenVariant ? Math.min(chosenVariant.stock, product.stock) : product.stock;
      const variantKey = chosenVariant ? JSON.stringify(Object.entries(chosenVariant.attributes).sort(([left], [right]) => left.localeCompare(right))) : '';
      const inventoryKey = `${item.productId}:${variantKey}`;
      const requestedVariantQuantity = (requestedByVariant.get(inventoryKey) || 0) + item.quantity;
      const requestedProductQuantity = (requestedByProduct.get(item.productId) || 0) + item.quantity;
      if (availableStock < requestedVariantQuantity) return NextResponse.json({ success: false, error: `“${item.name}” পণ্যটি বর্তমানে পর্যাপ্ত স্টকে নেই।` }, { status: 409 });
      if (product.maxOrderQuantity && requestedProductQuantity > product.maxOrderQuantity) {
        return NextResponse.json({ success: false, error: `“${item.name}” পণ্যের সর্বোচ্চ অর্ডার পরিমাণ ${product.maxOrderQuantity}টি।` }, { status: 400 });
      }
      requestedByVariant.set(inventoryKey, requestedVariantQuantity);
      requestedByProduct.set(item.productId, requestedProductQuantity);
      item.buyingPrice = Number(product.buyingPrice || 0);
      item.price = Number(chosenVariant?.price ?? product.salePrice ?? product.price);
    }
    const freeShippingForAll = normalizedItems.length > 0 && normalizedItems.every((item) => Boolean(item.productId && productById.get(item.productId)?.freeShipping));
    const shippingFee = freeShippingForAll ? 0 : /^(khulna|খুলনা)$/i.test(district) ? 80 : 150;
    const itemsSubtotal = normalizedItems.reduce((total, item) => total + item.price * item.quantity, 0);
    let appliedCoupon: { code: string; discount: number } | null = null;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode, isActive: true }).lean();
      if (!coupon || coupon.expiresAt && coupon.expiresAt.getTime() <= Date.now()) {
        return NextResponse.json({ success: false, error: 'কুপনটি পাওয়া যায়নি, নিষ্ক্রিয় বা মেয়াদোত্তীর্ণ।' }, { status: 400 });
      }
      if (itemsSubtotal < coupon.minimumPurchase) {
        return NextResponse.json({ success: false, error: `এই কুপনের জন্য সর্বনিম্ন ক্রয় ৳${coupon.minimumPurchase} হতে হবে।` }, { status: 400 });
      }
      const rawDiscount = coupon.discountType === 'percentage' ? itemsSubtotal * coupon.discountValue / 100 : coupon.discountValue;
      appliedCoupon = { code: coupon.code, discount: Math.round(Math.min(itemsSubtotal, rawDiscount, coupon.maxDiscount ?? Number.POSITIVE_INFINITY) * 100) / 100 };
    }
    const blockCriteria = [{ phone: customerPhone }, ...(customerIp ? [{ ip: customerIp }] : [])];
    const blocked = await BlockedCustomer.findOne({ $or: blockCriteria }).select('_id').lean();
    if (blocked) return NextResponse.json({ success: false, error: 'এই ফোন বা নেটওয়ার্ক থেকে অর্ডার গ্রহণ করা যাচ্ছে না।' }, { status: 403 });
    const newOrder = await Order.create({
      customerName,
      customerPhone,
      customerIp,
      customerAddress,
      shippingAddress,
      district,
      thana,
      shippingFee,
      discountAmount: appliedCoupon?.discount || 0,
      couponCode: appliedCoupon?.code || '',
      paymentMethod: 'ক্যাশ অন ডেলিভারি',
      source,
      isFake: false,
      assignedStaff,
      userEmail,
      userId,
      items: normalizedItems,
      totalAmount: itemsSubtotal + shippingFee - (appliedCoupon?.discount || 0),
      status: 'Pending',
    });
    if (/^[\w-]{16,100}$/.test(cartSessionId)) {
      await AbandonedCart.updateOne({ sessionId: cartSessionId }, { $set: { stage: 'converted', convertedAt: new Date() } });
    }

    const orderResponse = newOrder.toObject() as Record<string, unknown> & { userId?: unknown; items: Record<string, unknown>[] };
    delete orderResponse.userId;
    orderResponse.items.forEach((item) => { delete item.buyingPrice; });
    return NextResponse.json({ success: true, data: orderResponse }, { status: 201 });
  } catch (error) {
    console.error('Order POST Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server Error' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: orders }, { status: 200 });
  } catch (error) {
    console.error('Order GET Error:', error);
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Server Error' },
      { status: 500 }
    );
  }
}