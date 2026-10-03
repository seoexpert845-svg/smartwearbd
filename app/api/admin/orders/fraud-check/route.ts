import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import Order from '@/models/Order';

type Stats = {
  totalOrders: number;
  delivered: number;
  returned: number;
  cancelled?: number;
  successRate: number;
};

type ProviderResult = { name: string; statistics: Stats } | null;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const count = (value: unknown) => {
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : undefined;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function normalizeStats(result: Record<string, unknown>): Stats {
  const data = asRecord(result.data);
  const root = Object.keys(data).length ? data : result;
  const nestedStats = asRecord(root.statistics);
  const stats = Object.keys(nestedStats).length ? nestedStats : root;
  const totalOrders = count(stats.totalOrders ?? stats.total_orders ?? stats.total ?? stats.order_count ?? stats.total_parcel ?? stats.total_parcels);
  const delivered = count(stats.delivered ?? stats.totalDelivered ?? stats.total_delivered ?? stats.successful_deliveries ?? stats.success_parcel ?? stats.success_parcels ?? stats.delivered_parcel ?? stats.delivered_parcels);
  const explicitReturned = count(stats.returned ?? stats.totalReturned ?? stats.total_returned ?? stats.returns ?? stats.return_parcel ?? stats.returned_parcel ?? stats.return_parcels);
  const cancelled = count(stats.cancelled ?? stats.canceled ?? stats.total_cancelled ?? stats.total_canceled ?? stats.cancelled_parcel ?? stats.cancelled_parcels ?? stats.canceled_parcel ?? stats.canceled_parcels);
  const returned = explicitReturned ?? cancelled;

  if (totalOrders === undefined || delivered === undefined || returned === undefined) {
    throw new Error('Courier fraud response must include total, delivered, and returned/cancelled counts.');
  }
  if (delivered > totalOrders || returned > totalOrders || (cancelled !== undefined && cancelled > totalOrders)) {
    throw new Error('Courier fraud response contains inconsistent order counts.');
  }

  return {
    totalOrders,
    delivered,
    returned,
    ...(explicitReturned !== undefined && cancelled !== undefined ? { cancelled } : {}),
    successRate: totalOrders ? Math.round(delivered / totalOrders * 100) : 0,
  };
}

async function readProviderResponse(response: Response, provider: string) {
  if (!response.ok) throw new Error(`${provider} API returned ${response.status}.`);
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new Error(`${provider} API returned invalid JSON.`);
  }
  const result = asRecord(payload);
  if (result.error || result.success === false) {
    throw new Error(`${provider} API rejected the fraud check.`);
  }
  return normalizeStats(result);
}

async function fetchSteadfast(phone: string, endpoint: string, apiKey: string, secretKey: string): Promise<ProviderResult> {
  const url = endpoint.includes('{phone}')
    ? endpoint.replace('{phone}', encodeURIComponent(phone))
    : `${endpoint.replace(/\/+$/, '')}/${encodeURIComponent(phone)}`;
  const response = await fetch(url, {
    headers: { 'Api-Key': apiKey, 'Secret-Key': secretKey },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  return { name: 'Steadfast', statistics: await readProviderResponse(response, 'Steadfast') };
}

async function fetchAggregator(phone: string, endpoint: string, apiKey: string): Promise<ProviderResult> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(apiKey ? { Authorization: `Bearer ${apiKey}`, 'X-API-Key': apiKey } : {}),
    },
    body: JSON.stringify({ phone, customer_phone: phone, mobile: phone }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  const name = process.env.COURIER_FRAUD_CHECK_PROVIDER || 'Third-party courier aggregator';
  return { name, statistics: await readProviderResponse(response, name) };
}

async function tryProvider(provider: () => Promise<ProviderResult>, name: string) {
  try {
    return { result: await provider(), error: '' };
  } catch (error) {
    console.error(`${name} fraud check failed:`, error);
    return { result: null, error: `${name} lookup failed. Check its API credentials and response.` };
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  try {
    const body = asRecord(await request.json());
    const phone = String(body.phone || '').replace(/\D/g, '');
    const orderId = String(body.orderId || '');
    if (!/^01[3-9]\d{8}$/.test(phone)) return NextResponse.json({ success: false, error: 'বাংলাদেশি ১১ সংখ্যার ফোন নম্বর দিন।' }, { status: 400 });

    const aggregatorEndpoint = process.env.COURIER_FRAUD_CHECK_API_URL || process.env.FRAUD_CHECK_API_URL || '';
    const aggregatorKey = process.env.COURIER_FRAUD_CHECK_API_KEY || process.env.FRAUD_CHECK_API_KEY || '';
    const steadfastEndpoint = process.env.STEADFAST_FRAUD_CHECK_API_URL || 'https://portal.packzy.com/api/v1/fraud_check/{phone}';
    const steadfastKey = process.env.STEADFAST_API_KEY || '';
    const steadfastSecret = process.env.STEADFAST_SECRET_KEY || '';
    const steadfastConfigured = Boolean(steadfastKey || steadfastSecret || process.env.STEADFAST_FRAUD_CHECK_API_URL);
    const aggregatorConfigured = Boolean(aggregatorEndpoint);

    if (mongoose.isValidObjectId(orderId)) {
      await connectDB();
      const cachedOrder = await Order.findById(orderId);
      if (cachedOrder && String(cachedOrder.customerPhone || '').replace(/\D/g, '') !== phone) {
        return NextResponse.json({ success: false, error: 'Fraud-check phone does not match this order.' }, { status: 400 });
      }
      const cache = cachedOrder?.fraudCheck;
      const checkedAt = cache?.checkedAt ? new Date(cache.checkedAt).getTime() : 0;
      if (cache?.checkedPhone === phone && checkedAt > Date.now() - CACHE_TTL_MS
        && Number.isFinite(cache.totalOrders) && Number.isFinite(cache.delivered)
        && Number.isFinite(cache.returned) && Number.isFinite(cache.successRate)) {
        return NextResponse.json({
          success: true,
          configured: true,
          cached: true,
          provider: cache.provider,
          checkedAt: new Date(checkedAt).toISOString(),
          statistics: {
            totalOrders: cache.totalOrders,
            delivered: cache.delivered,
            returned: cache.returned,
            ...(Number.isFinite(cache.cancelled) ? { cancelled: cache.cancelled } : {}),
            successRate: cache.successRate,
          },
        });
      }
    }

    if (!steadfastConfigured && !aggregatorConfigured) {
      return NextResponse.json({
        success: true,
        configured: false,
        mode: 'unconfigured',
        statistics: null,
        message: 'Configure Steadfast API credentials or a third-party courier fraud API to query live courier history.',
      });
    }

    const [steadfastAttempt, aggregatorAttempt] = await Promise.all([
      steadfastConfigured
        ? tryProvider(
          () => {
            if (!steadfastKey || !steadfastSecret) throw new Error('Steadfast API key and secret are both required.');
            return fetchSteadfast(phone, steadfastEndpoint, steadfastKey, steadfastSecret);
          },
          'Steadfast',
        )
        : Promise.resolve({ result: null, error: '' }),
      aggregatorConfigured
        ? tryProvider(() => fetchAggregator(phone, aggregatorEndpoint, aggregatorKey), 'Third-party courier aggregator')
        : Promise.resolve({ result: null, error: '' }),
    ]);

    const primary = aggregatorAttempt.result || steadfastAttempt.result;
    if (!primary) {
      return NextResponse.json({
        success: false,
        error: [steadfastAttempt.error, aggregatorAttempt.error].filter(Boolean).join(' ') || 'No courier fraud provider is configured.',
      }, { status: aggregatorConfigured || steadfastConfigured ? 502 : 503 });
    }

    const checkedAt = new Date();
    if (mongoose.isValidObjectId(orderId)) {
      await connectDB();
      const order = await Order.findById(orderId);
      if (order && String(order.customerPhone || '').replace(/\D/g, '') !== phone) {
        return NextResponse.json({ success: false, error: 'Fraud-check phone does not match this order.' }, { status: 400 });
      }
      if (order) {
        order.fraudCheck = {
          ...primary.statistics,
          checkedPhone: phone,
          provider: primary.name,
          checkedAt,
          mock: false,
        };
        order.activityLog.push({
          action: 'Fraud check',
          actor: getAdminActor(request) || 'Admin',
          details: `Courier history lookup for ${phone} via ${primary.name}`,
          createdAt: checkedAt,
        });
        await order.save();
      }
    }

    const warnings = [steadfastAttempt.error, aggregatorAttempt.error].filter(Boolean);
    return NextResponse.json({
      success: true,
      configured: true,
      cached: false,
      provider: primary.name,
      checkedAt: checkedAt.toISOString(),
      statistics: primary.statistics,
      ...(warnings.length ? { warning: warnings.join(' ') } : {}),
    });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Fraud check failed.' }, { status: 502 });
  }
}
