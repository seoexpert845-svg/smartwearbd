import { NextResponse } from 'next/server';
import type { Model } from 'mongoose';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import Brand from '@/models/Brand';
import ProductSection from '@/models/ProductSection';
import VariantAttribute from '@/models/VariantAttribute';
import ProductReview from '@/models/ProductReview';

type Context = { params: Promise<{ resource: string }> | { resource: string } };
type CatalogRecord = Record<string, unknown>;
type Resource = 'brands' | 'sections' | 'variants' | 'reviews';

const modelsByResource: Record<Resource, Model<CatalogRecord>> = {
  brands: Brand as unknown as Model<CatalogRecord>,
  sections: ProductSection as unknown as Model<CatalogRecord>,
  variants: VariantAttribute as unknown as Model<CatalogRecord>,
  reviews: ProductReview as unknown as Model<CatalogRecord>,
};

async function getModel(context: Context) {
  const { resource } = await context.params;
  if (!Object.hasOwn(modelsByResource, resource)) return null;
  return modelsByResource[resource as Resource];
}

export async function GET(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const collection = await getModel(context);
    if (!collection) return NextResponse.json({ success: false, error: 'ক্যাটালগ রিসোর্স পাওয়া যায়নি।' }, { status: 404 });
    await connectDB();
    const data = await collection.find({}).sort({ createdAt: -1 }).lean();
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'তথ্য লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function POST(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { resource } = await context.params;
    const collection = await getModel(context);
    if (!collection) return NextResponse.json({ success: false, error: 'ক্যাটালগ রিসোর্স পাওয়া যায়নি।' }, { status: 404 });
    const body = await request.json() as CatalogRecord;
    let record: CatalogRecord;
    if (resource === 'brands') {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ success: false, error: 'ব্র্যান্ডের নাম প্রয়োজন।' }, { status: 400 });
      record = { name, description: String(body.description || '').trim(), logoUrl: String(body.logoUrl || '').trim() };
    } else if (resource === 'sections') {
      const name = String(body.name || '').trim();
      if (!name) return NextResponse.json({ success: false, error: 'সেকশনের নাম প্রয়োজন।' }, { status: 400 });
      const slug = String(body.slug || name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '')).trim();
      record = { name, slug, description: String(body.description || '').trim(), sortOrder: Number(body.sortOrder ?? 0), isActive: body.isActive !== false };
    } else if (resource === 'variants') {
      const name = String(body.name || '').trim();
      const values = Array.isArray(body.values) ? [...new Set(body.values.map(String).map((value) => value.trim()).filter(Boolean))] : [];
      if (!name || !values.length) return NextResponse.json({ success: false, error: 'অ্যাট্রিবিউটের নাম ও অন্তত একটি ভ্যালু প্রয়োজন।' }, { status: 400 });
      record = { name, values };
    } else {
      const productId = String(body.productId || '');
      const rating = Number(body.rating);
      const text = String(body.text || '').trim();
      const reviewerName = String(body.reviewerName || '').trim();
      if (!mongoose.isValidObjectId(productId) || !reviewerName || !text || !Number.isInteger(rating) || rating < 1 || rating > 5) {
        return NextResponse.json({ success: false, error: 'রিভিউয়ের তথ্য সঠিক নয়।' }, { status: 400 });
      }
      record = { productId, productName: String(body.productName || ''), reviewerName, phone: String(body.phone || ''), rating, text, imageUrl: String(body.imageUrl || ''), status: 'Approved', verifiedBuyer: false, createdByAdmin: true };
    }
    await connectDB();
    const created = await collection.create(record);
    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    const status = error instanceof mongoose.Error && error.name === 'ValidationError' ? 400 : 409;
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'তথ্য সংরক্ষণ করা যায়নি।' }, { status });
  }
}

export async function PATCH(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { resource } = await context.params;
    const collection = await getModel(context);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!collection || !mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'রিসোর্স বা আইডি সঠিক নয়।' }, { status: 400 });
    const body = await request.json() as CatalogRecord;
    const updates: CatalogRecord = {};
    if (resource === 'brands') {
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.description !== undefined) updates.description = String(body.description).trim();
      if (body.logoUrl !== undefined) updates.logoUrl = String(body.logoUrl).trim();
      if (body.isActive !== undefined) updates.isActive = body.isActive === true;
    } else if (resource === 'sections') {
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.slug !== undefined) updates.slug = String(body.slug).trim().toLowerCase();
      if (body.description !== undefined) updates.description = String(body.description).trim();
      if (body.sortOrder !== undefined) updates.sortOrder = Number(body.sortOrder);
      if (body.isActive !== undefined) updates.isActive = body.isActive === true;
    } else if (resource === 'variants') {
      if (body.name !== undefined) updates.name = String(body.name).trim();
      if (body.values !== undefined && Array.isArray(body.values)) updates.values = [...new Set(body.values.map(String).map((value) => value.trim()).filter(Boolean))];
    } else if (body.status === 'Pending' || body.status === 'Approved' || body.status === 'Rejected') {
      updates.status = body.status;
    } else {
      return NextResponse.json({ success: false, error: 'রিভিউ স্ট্যাটাস সঠিক নয়।' }, { status: 400 });
    }
    const updated = await collection.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!updated) return NextResponse.json({ success: false, error: 'রেকর্ডটি পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'তথ্য আপডেট করা যায়নি।' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const collection = await getModel(context);
    const id = new URL(request.url).searchParams.get('id') || '';
    if (!collection || !mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'রিসোর্স বা আইডি সঠিক নয়।' }, { status: 400 });
    const removed = await collection.findByIdAndDelete(id);
    if (!removed) return NextResponse.json({ success: false, error: 'রেকর্ডটি পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'রেকর্ড মুছতে ব্যর্থ হয়েছে।' }, { status: 500 });
  }
}
