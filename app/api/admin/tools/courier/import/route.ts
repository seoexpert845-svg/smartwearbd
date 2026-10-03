import * as XLSX from '@e965/xlsx';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import { COURIER_NAMES } from '@/lib/courier-credentials';
import Order from '@/models/Order';

const normalizeKey = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');

function cell(row: Record<string, unknown>, keys: string[]) {
  const entry = Object.entries(row).find(([key]) => keys.includes(normalizeKey(key)));
  return entry?.[1];
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const form = await request.formData();
    const file = form.get('file');
    const courier = String(form.get('courier') || '');
    if (!(file instanceof File) || !/\.(?:csv|xlsx?|xls)$/i.test(file.name) || file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ success: false, error: '১০ MB-এর মধ্যে CSV, XLS বা XLSX রিপোর্ট আপলোড করুন।' }, { status: 400 });
    }
    if (!COURIER_NAMES.includes(courier as (typeof COURIER_NAMES)[number])) {
      return NextResponse.json({ success: false, error: 'কুরিয়ার নির্বাচন সঠিক নয়।' }, { status: 400 });
    }
    const workbook = XLSX.read(Buffer.from(await file.arrayBuffer()), { type: 'buffer', cellDates: true });
    const worksheet = workbook.Sheets[workbook.SheetNames[0] || ''];
    if (!worksheet) return NextResponse.json({ success: false, error: 'ফাইলে কোনো ডেটা পাওয়া যায়নি।' }, { status: 400 });
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, { defval: '' });
    if (!rows.length || rows.length > 5000) return NextResponse.json({ success: false, error: 'রিপোর্টে ১ থেকে ৫,০০০টি ডেটা সারি থাকতে হবে।' }, { status: 400 });

    await connectDB();
    const actor = getAdminActor(request) || 'Admin';
    let updated = 0;
    const errors: string[] = [];
    for (const [index, row] of rows.entries()) {
      const invoice = String(cell(row, ['invoice', 'invoiceid', 'ordernumber', 'orderid', 'merchantorderid']) || '').trim();
      const trackingId = String(cell(row, ['trackingid', 'trackingcode', 'consignmentid', 'waybill']) || '').trim();
      const providerStatus = String(cell(row, ['status', 'deliverystatus', 'shipmentstatus']) || '').trim();
      const rawPaymentValue = cell(row, ['collected', 'collectedamount', 'codcollected', 'amountcollected', 'codamount']);
      const paymentValue = rawPaymentValue === '' || rawPaymentValue === undefined ? Number.NaN : Number(rawPaymentValue);
      const paymentState = normalizeKey(cell(row, ['paymentstatus', 'settlementstatus']));
      const id = /^[a-f\d]{24}$/i.test(invoice) ? invoice : undefined;
      const filter = id ? { $or: [{ _id: id }, ...(trackingId ? [{ trackingId }] : [])] } : trackingId ? { trackingId } : null;
      if (!filter) {
        errors.push(`Row ${index + 2}: order invoice or tracking ID is missing.`);
        continue;
      }
      const order = await Order.findOne(filter);
      if (!order) {
        errors.push(`Row ${index + 2}: matching order not found.`);
        continue;
      }
      if (trackingId) order.trackingId = trackingId;
      order.courierName = courier;
      if (providerStatus) order.courierStatus = providerStatus;
      if (Number.isFinite(paymentValue) && paymentValue >= 0) order.courierCollectedAmount = paymentValue;
      if (paymentState === 'paid' || paymentState === 'settled') order.courierPaymentStatus = 'Paid';
      else if (paymentState === 'unpaid' || paymentState === 'pending') order.courierPaymentStatus = 'Unpaid';
      const lowerStatus = providerStatus.toLowerCase().replace(/[\s-]+/g, '_');
      const status = lowerStatus.includes('partial') ? 'Partial Delivered'
        : lowerStatus.includes('deliver') ? 'Delivered'
          : lowerStatus.includes('return') ? 'Returned'
            : lowerStatus.includes('transit') || lowerStatus.includes('pickup') ? 'In Transit'
              : lowerStatus.includes('cancel') ? 'Cancelled'
                : lowerStatus.includes('lost') ? 'Lost' : '';
      if (status) order.status = status;
      order.activityLog.push({ action: 'Courier report import', actor, details: `${courier}: ${trackingId || invoice}`, createdAt: new Date() });
      await order.save();
      updated += 1;
    }
    return NextResponse.json({ success: true, data: { updated, errors: errors.slice(0, 50), errorCount: errors.length } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'কুরিয়ার রিপোর্ট ইমপোর্ট করা যায়নি।' }, { status: 500 });
  }
}
