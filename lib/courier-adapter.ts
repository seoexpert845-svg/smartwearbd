import { readCourierCredentials } from '@/lib/courier-credentials';

export const COURIERS = ['Steadfast', 'Pathao', 'RedX', 'Carrybee'] as const;
export type CourierName = (typeof COURIERS)[number];

type DispatchOrder = {
  id: string;
  customerName: string;
  customerPhone: string;
  address: string;
  totalAmount: number;
  note?: string;
};

const envPrefix: Record<CourierName, string> = {
  Steadfast: 'STEADFAST',
  Pathao: 'PATHAO',
  RedX: 'REDX',
  Carrybee: 'CARRYBEE',
};

export async function dispatchCourier(courier: CourierName, order: DispatchOrder) {
  const prefix = envPrefix[courier];
  const savedCredentials = await readCourierCredentials(courier);
  const endpoint = process.env[`${prefix}_ORDER_API_URL`] || savedCredentials?.baseApiUrl;
  const apiKey = process.env[`${prefix}_API_KEY`] || savedCredentials?.apiKey;
  const secretKey = process.env[`${prefix}_SECRET_KEY`] || savedCredentials?.secretKey;
  const accessToken = process.env[`${prefix}_ACCESS_TOKEN`] || savedCredentials?.apiKey;
  if (!endpoint || (courier === 'Steadfast' ? !apiKey || !secretKey : !accessToken)) {
    throw new Error(`${courier} API credentials are not configured.`);
  }

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (courier === 'Steadfast') {
    headers['Api-Key'] = apiKey!;
    headers['Secret-Key'] = secretKey!;
  } else headers.Authorization = `Bearer ${accessToken}`;

  const payload = courier === 'Steadfast'
    ? {
        invoice: order.id,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: order.address,
        cod_amount: order.totalAmount,
        note: order.note || '',
      }
    : {
        merchant_order_id: order.id,
        recipient_name: order.customerName,
        recipient_phone: order.customerPhone,
        recipient_address: order.address,
        amount_to_collect: order.totalAmount,
        special_instruction: order.note || '',
      };

  const response = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(payload), cache: 'no-store' });
  const responseText = await response.text();
  let data: Record<string, unknown> = {};
  try { data = JSON.parse(responseText) as Record<string, unknown>; } catch { data = { raw: responseText.slice(0, 2000) }; }
  if (!response.ok) throw new Error(`${courier} API returned ${response.status}.`);
  const trackingId = String(data.consignment_id || data.tracking_code || data.tracking_id || data.trackingId || data.data && (data.data as Record<string, unknown>).consignment_id || '');
  if (!trackingId) throw new Error(`${courier} response did not contain a tracking ID.`);
  return { trackingId, data };
}