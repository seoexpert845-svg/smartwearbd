import { isIP } from 'node:net';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { getAdminActor, requireAdmin } from '@/lib/auth-api';
import BlockedCustomer from '@/models/BlockedCustomer';

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json() as Record<string, unknown>;
    const phone = String(body.phone || '').replace(/\D/g, '').slice(0, 14);
    const ip = String(body.ip || '').trim();
    const reason = String(body.reason || '').trim().slice(0, 240);
    if (phone && !/^\d{10,14}$/.test(phone)) return NextResponse.json({ success: false, error: 'ফোন নম্বর সঠিক নয়।' }, { status: 400 });
    if (ip && !isIP(ip)) return NextResponse.json({ success: false, error: 'IP address সঠিক নয়।' }, { status: 400 });
    if (!phone && !ip) return NextResponse.json({ success: false, error: 'ফোন নম্বর অথবা IP প্রয়োজন।' }, { status: 400 });

    await connectDB();
    const criteria: Record<string, string>[] = [];
    if (phone) criteria.push({ phone });
    if (ip) criteria.push({ ip });
    const existing = await BlockedCustomer.findOne({ $or: criteria });
    if (existing) return NextResponse.json({ success: true, data: existing, alreadyBlocked: true });
    const blocked = await BlockedCustomer.create({ phone, ip, reason, createdBy: getAdminActor(request) || 'Admin' });
    return NextResponse.json({ success: true, data: blocked }, { status: 201 });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Block করা যায়নি।' }, { status: 500 });
  }
}