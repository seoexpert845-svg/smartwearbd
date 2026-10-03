import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth-api';

const DAY_MS = 24 * 60 * 60 * 1000;
const BANGLADESH_OFFSET_MS = 6 * 60 * 60 * 1000;
const SOURCES = ['Website', 'App', 'Facebook', 'Instagram', 'WhatsApp'] as const;
const STATUS_LABELS = ['Delivered', 'Pending', 'Processing', 'Cancelled', 'In-Transit', 'Fake'] as const;

type RawOrder = {
  _id: unknown;
  customerName?: string;
  customerPhone?: string;
  customerAddress?: string;
  shippingAddress?: string;
  district?: string;
  status?: string;
  isFake?: boolean;
  source?: string;
  assignedStaff?: string;
  managedBy?: string;
  employeeName?: string;
  totalAmount?: number;
  createdAt?: Date | string;
  items?: { productId?: string; name?: string; quantity?: number; price?: number; imageUrl?: string }[];
};

function orderStatus(order: RawOrder) {
  if (order.isFake || order.status?.toLowerCase() === 'fake') return 'Fake';
  const status = order.status?.toLowerCase() || '';
  if (status === 'delivered') return 'Delivered';
  if (status === 'cancelled' || status === 'canceled') return 'Cancelled';
  if (['shipped', 'in-transit', 'in transit', 'out for delivery'].includes(status)) return 'In-Transit';
  if (['confirmed', 'processing'].includes(status)) return 'Processing';
  return 'Pending';
}

function orderRegion(order: RawOrder) {
  if (order.district?.trim()) return order.district.trim();
  const address = order.customerAddress || order.shippingAddress || '';
  return address.match(/জেলা\s*:\s*([^,]+)/i)?.[1]?.trim() || 'উল্লেখ নেই';
}

function isoDay(value: Date | string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(value));
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const params = new URL(request.url).searchParams;
    const startValue = params.get('start') || new Date().toISOString().slice(0, 10);
    const endValue = params.get('end') || startValue;
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(startValue) || !datePattern.test(endValue)) {
      return NextResponse.json({ success: false, error: 'তারিখের সীমা সঠিক নয়।' }, { status: 400 });
    }

    const rangeStart = new Date(`${startValue}T00:00:00+06:00`);
    const rangeEnd = new Date(`${endValue}T00:00:00+06:00`);
    if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeStart > rangeEnd || rangeEnd.getTime() - rangeStart.getTime() > 366 * DAY_MS) {
      return NextResponse.json({ success: false, error: 'সর্বোচ্চ ৩৬৬ দিনের বৈধ তারিখসীমা নির্বাচন করুন।' }, { status: 400 });
    }
    rangeEnd.setTime(rangeEnd.getTime() + DAY_MS);

    const bangladeshToday = new Date(Date.now() + BANGLADESH_OFFSET_MS);
    bangladeshToday.setUTCHours(0, 0, 0, 0);
    const heatmapEnd = new Date(bangladeshToday.getTime() + BANGLADESH_OFFSET_MS + DAY_MS);
    const heatmapStart = new Date(heatmapEnd.getTime() - 365 * DAY_MS);
    await connectDB();
    const [rangeOrders, heatmapOrders, recentOrders, products] = await Promise.all([
      Order.find({ createdAt: { $gte: rangeStart, $lt: rangeEnd } }).sort({ createdAt: -1 }).lean(),
      Order.find({ createdAt: { $gte: heatmapStart, $lt: heatmapEnd } }).select('createdAt').lean(),
      Order.find({}).sort({ createdAt: -1 }).limit(6).select('customerName customerPhone totalAmount status createdAt').lean(),
      Product.find({}).select('name price salePrice imageUrl images stock').lean(),
    ]);

    const orders = rangeOrders as unknown as RawOrder[];
    const productRows = products.map((product) => ({
      id: String(product._id),
      name: product.name,
      price: Number(product.salePrice ?? product.price ?? 0),
      imageUrl: product.imageUrl || product.images?.[0] || '',
      stock: Number(product.stock || 0),
    }));
    const productImageById = new Map(productRows.map((product) => [product.id, product.imageUrl]));
    const statusCounts = Object.fromEntries(STATUS_LABELS.map((status) => [status, 0])) as Record<(typeof STATUS_LABELS)[number], number>;
    const sourceCounts = Object.fromEntries(SOURCES.map((source) => [source, 0])) as Record<(typeof SOURCES)[number], number>;
    let unattributedSources = 0;
    let totalItems = 0;
    let totalRevenue = 0;
    let fakeOrders = 0;
    const customers = new Set<string>();
    const hourly = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0 }));
    const heatmapCounts = new Map<string, number>();
    const sellers = new Map<string, { id: string; name: string; quantity: number; revenue: number; imageUrl: string }>();
    const regions = new Map<string, number>();
    const staff = new Map<string, Record<string, number>>();

    for (const order of orders) {
      const status = orderStatus(order);
      statusCounts[status] += 1;
      if (status === 'Fake') fakeOrders += 1;
      totalRevenue += Number(order.totalAmount || 0);
      const customerKey = (order.customerPhone || order.customerName || '').trim().toLowerCase();
      if (customerKey) customers.add(customerKey);
      const source = order.source?.trim();
      if (SOURCES.includes(source as (typeof SOURCES)[number])) sourceCounts[source as (typeof SOURCES)[number]] += 1;
      else unattributedSources += 1;

      if (order.createdAt) {
        const created = new Date(order.createdAt);
        if (!Number.isNaN(created.getTime())) hourly[(created.getUTCHours() + 6) % 24].count += 1;
      }

      const region = orderRegion(order);
      regions.set(region, (regions.get(region) || 0) + 1);
      const staffName = order.assignedStaff?.trim() || order.managedBy?.trim() || order.employeeName?.trim() || 'Unassigned';
      const row = staff.get(staffName) || { Pending: 0, Confirmed: 0, Delivered: 0, Cancelled: 0 };
      if (status === 'Pending') row.Pending += 1;
      else if (status === 'Processing' || status === 'In-Transit') row.Confirmed += 1;
      else if (status === 'Delivered') row.Delivered += 1;
      else if (status === 'Cancelled' || status === 'Fake') row.Cancelled += 1;
      staff.set(staffName, row);

      for (const item of order.items || []) {
        const quantity = Math.max(0, Number(item.quantity || 0));
        const id = item.productId || item.name || 'unknown';
        const seller = sellers.get(id) || {
          id,
          name: item.name || 'পণ্য',
          quantity: 0,
          revenue: 0,
          imageUrl: item.imageUrl || productImageById.get(item.productId || '') || '',
        };
        seller.quantity += quantity;
        seller.revenue += Number(item.price || 0) * quantity;
        totalItems += quantity;
        sellers.set(id, seller);
      }
    }

    for (const order of heatmapOrders) {
      if (order.createdAt) {
        const key = isoDay(order.createdAt);
        heatmapCounts.set(key, (heatmapCounts.get(key) || 0) + 1);
      }
    }

    const activity = Array.from({ length: 365 }, (_, index) => {
      const date = new Date(heatmapStart.getTime() + index * DAY_MS);
      const key = isoDay(date);
      return { date: key, count: heatmapCounts.get(key) || 0 };
    });
    const notifications = recentOrders.map((order) => ({
      id: String(order._id),
      customerName: order.customerName || 'নাম উল্লেখ নেই',
      totalAmount: Number(order.totalAmount || 0),
      status: order.status || 'Pending',
      createdAt: order.createdAt,
    }));

    return NextResponse.json({
      success: true,
      data: {
        period: {
          start: startValue,
          end: endValue,
          totalOrders: orders.length,
          totalRevenue,
          totalItems,
          totalCustomers: customers.size,
        },
        statuses: STATUS_LABELS.map((label) => ({ label, count: statusCounts[label] })),
        sources: [...SOURCES.map((label) => ({ label, count: sourceCounts[label] })), { label: 'Unattributed', count: unattributedSources }],
        hourly,
        health: { real: Math.max(0, orders.length - fakeOrders), fake: fakeOrders },
        activity,
        topProducts: [...sellers.values()].sort((left, right) => right.quantity - left.quantity).slice(0, 5),
        regions: [...regions.entries()].map(([name, count]) => ({ name, count })).sort((left, right) => right.count - left.count).slice(0, 6),
        employees: [...staff.entries()].map(([name, counts]) => ({ name, Pending: counts.Pending, Confirmed: counts.Confirmed, Delivered: counts.Delivered, Cancelled: counts.Cancelled })).sort((left, right) => right.Pending + right.Confirmed + right.Delivered + right.Cancelled - (left.Pending + left.Confirmed + left.Delivered + left.Cancelled)).slice(0, 12),
        inventory: {
          lowStockCount: productRows.filter((product) => product.stock <= 5).length,
          outOfStockCount: productRows.filter((product) => product.stock === 0).length,
          products: productRows,
        },
        notifications,
        sms: { configured: false, balance: null },
      },
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'অ্যানালিটিক্স লোড করা যায়নি।' }, { status: 500 });
  }
}