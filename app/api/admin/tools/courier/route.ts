import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import { COURIER_NAMES, decryptCredentials, encryptCredentials, readCourierConfiguration, type CourierCredentials } from '@/lib/courier-credentials';
import Order from '@/models/Order';
import SiteSetting from '@/models/SiteSetting';

type Zone = { name: string; fee: number };
type ProviderSettings = { credentials?: string; baseApiUrl?: string; storeId?: string; zones?: Zone[] };

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    await connectDB();
    const [configuration, orders, settings, paymentTotals] = await Promise.all([
      readCourierConfiguration(),
      Order.find({ $or: [{ courierName: { $ne: '' } }, { trackingId: { $ne: '' } }] }).sort({ updatedAt: -1 }).limit(500).lean(),
      SiteSetting.findOne({ key: 'store' }).select('deliveryZones').lean(),
      Order.aggregate<{ _id: string; total: number }>([
        { $match: { $or: [{ courierName: { $ne: '' } }, { trackingId: { $ne: '' } }] } },
        { $group: { _id: '$courierPaymentStatus', total: { $sum: '$courierCollectedAmount' } } },
      ]),
    ]);
    const courierConfiguration = Object.fromEntries(COURIER_NAMES.map((name) => {
      const config = (configuration[name] || {}) as ProviderSettings;
      return [name, {
        configured: Boolean(config.credentials),
        baseApiUrl: config.baseApiUrl || '',
        storeId: config.storeId || '',
        zones: settings?.deliveryZones || [],
      }];
    }));
    const total = paymentTotals.reduce((sum, entry) => sum + entry.total, 0);
    const paid = paymentTotals.find((entry) => entry._id === 'Paid')?.total || 0;
    return NextResponse.json({
      success: true,
      data: {
        couriers: courierConfiguration,
        orders,
        payments: {
          total,
          paid,
          unpaid: total - paid,
        },
      },
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুরিয়ার তথ্য লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'কুরিয়ার সেটিংস সঠিক নয়।' }, { status: 400 });
    }
    const input = body as Record<string, unknown>;
    const name = String(input.courier || '') as (typeof COURIER_NAMES)[number];
    if (!COURIER_NAMES.includes(name)) return NextResponse.json({ success: false, error: 'কুরিয়ার নির্বাচন সঠিক নয়।' }, { status: 400 });

    const credentials: CourierCredentials = {
      apiKey: typeof input.apiKey === 'string' ? input.apiKey.trim() : '',
      secretKey: typeof input.secretKey === 'string' ? input.secretKey.trim() : '',
      webhookToken: typeof input.webhookToken === 'string' ? input.webhookToken.trim() : '',
      storeId: typeof input.storeId === 'string' ? input.storeId.trim() : '',
      baseApiUrl: typeof input.baseApiUrl === 'string' ? input.baseApiUrl.trim().replace(/\/+$/, '') : '',
    };
    if (credentials.baseApiUrl) {
      try {
        const endpoint = new URL(credentials.baseApiUrl);
        if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) throw new Error('Invalid URL');
      } catch {
        return NextResponse.json({ success: false, error: 'Base API URL একটি সঠিক HTTP/HTTPS URL হতে হবে।' }, { status: 400 });
      }
    }
    if (Object.values(credentials).some((value) => value.length > 4096)) {
      return NextResponse.json({ success: false, error: 'কুরিয়ার API সেটিংস খুব দীর্ঘ।' }, { status: 400 });
    }
    if (input.zones !== undefined && !Array.isArray(input.zones)) {
      return NextResponse.json({ success: false, error: 'ডেলিভারি জোনগুলো একটি তালিকা হতে হবে।' }, { status: 400 });
    }
    if (Array.isArray(input.zones)) {
      if (input.zones.length > 100 || input.zones.some((zone) => {
        if (!zone || typeof zone !== 'object' || Array.isArray(zone)) return true;
        const entry = zone as Record<string, unknown>;
        return typeof entry.name !== 'string' || !entry.name.trim() || entry.name.length > 100
          || !Number.isFinite(Number(entry.fee)) || Number(entry.fee) < 0 || Number(entry.fee) > 1_000_000;
      })) {
        return NextResponse.json({ success: false, error: 'ডেলিভারি জোন ও ফি সঠিকভাবে দিন।' }, { status: 400 });
      }
    }

    await connectDB();
    const configuration = await readCourierConfiguration();
    const previous = (configuration[name] || {}) as ProviderSettings;
    const savedCredentials = previous.credentials && input.clearCredentials !== true ? decryptCredentials(previous.credentials) : {
      apiKey: '', secretKey: '', webhookToken: '', storeId: '', baseApiUrl: '',
    };
    const mergedCredentials = Object.fromEntries(Object.entries(credentials).map(([key, value]) => [
      key, value || savedCredentials[key as keyof CourierCredentials] || '',
    ])) as CourierCredentials;
    const hasCredentials = Object.entries(credentials).some(([key, value]) => key !== 'baseApiUrl' && key !== 'storeId' && Boolean(value)) || Boolean(previous.credentials);
    const next: ProviderSettings = {
      ...previous,
      baseApiUrl: credentials.baseApiUrl || previous.baseApiUrl || '',
      storeId: credentials.storeId || previous.storeId || '',
      ...(input.clearCredentials === true ? { credentials: '' } : {}),
      ...(hasCredentials && input.clearCredentials !== true ? { credentials: encryptCredentials(mergedCredentials) } : {}),
    };
    const updates: Record<string, unknown> = { [`courierSettings.${name}`]: next };
    if (Array.isArray(input.zones)) updates.deliveryZones = input.zones as Zone[];
    await SiteSetting.findOneAndUpdate(
      { key: 'store' },
      { $set: updates, $setOnInsert: { key: 'store' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, data: { courier: name, configured: Boolean(next.credentials), baseApiUrl: next.baseApiUrl, storeId: next.storeId } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুরিয়ার সেটিংস সেভ করা যায়নি।' }, { status: 500 });
  }
}
