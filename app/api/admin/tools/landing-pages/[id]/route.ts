import mongoose from 'mongoose';
import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import LandingPage from '@/models/LandingPage';
import Product from '@/models/Product';
import { validatePage } from '@/lib/landing-page-validation';

type Context = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Landing page ID is invalid.' }, { status: 400 });
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) return NextResponse.json({ success: false, error: 'Landing page data is invalid.' }, { status: 400 });
    const input = body as Record<string, unknown>;
    const invalid = validatePage(input);
    if (invalid) return NextResponse.json({ success: false, error: invalid }, { status: 400 });
    await connectDB();
    const duplicate = await LandingPage.exists({ slug: input.slug, _id: { $ne: id } });
    if (duplicate) return NextResponse.json({ success: false, error: 'This page slug is already in use.' }, { status: 409 });
    const productIds = input.featuredProducts as string[];
    if (productIds.length && await Product.countDocuments({ _id: { $in: productIds } }) !== new Set(productIds).size) {
      return NextResponse.json({ success: false, error: 'One or more featured products could not be found.' }, { status: 400 });
    }
    const page = await LandingPage.findByIdAndUpdate(id, { $set: input }, { new: true, runValidators: true });
    if (!page) return NextResponse.json({ success: false, error: 'Landing page not found.' }, { status: 404 });
    return NextResponse.json({ success: true, data: page });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return NextResponse.json({ success: false, error: 'This page slug is already in use.' }, { status: 409 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Landing page could not be saved.' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'Landing page ID is invalid.' }, { status: 400 });
    await connectDB();
    const page = await LandingPage.findByIdAndDelete(id);
    if (!page) return NextResponse.json({ success: false, error: 'Landing page not found.' }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Landing page could not be deleted.' }, { status: 500 });
  }
}
