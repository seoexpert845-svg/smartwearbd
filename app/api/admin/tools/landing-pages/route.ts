import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import LandingPage from '@/models/LandingPage';
import Product from '@/models/Product';
import { validatePage } from '@/lib/landing-page-validation';

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const pages = await LandingPage.find().sort({ updatedAt: -1 }).lean();
    return NextResponse.json({ success: true, data: pages });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Landing pages could not be loaded.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'Landing page data is invalid.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const invalid = validatePage(input);
    if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });
    await connectDB();
    const existing = await LandingPage.exists({ slug: input.slug });
    if (existing) return NextResponse.json({ success: false, error: 'This page slug is already in use.' }, { status: 409 });
    const productIds = input.featuredProducts as string[];
    if (productIds.length) {
      const count = await Product.countDocuments({ _id: { $in: productIds } });
      if (count !== new Set(productIds).size) return NextResponse.json({ success: false, error: 'One or more featured products could not be found.' }, { status: 400 });
    }
    const page = await LandingPage.create(input);
    return NextResponse.json({ success: true, data: page }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return NextResponse.json({ success: false, error: 'This page slug is already in use.' }, { status: 409 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Landing page could not be created.' }, { status: 500 });
  }
}
