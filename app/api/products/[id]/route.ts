import { NextResponse } from 'next/server';
import mongoose from 'mongoose';
import connectDB from '@/lib/db';
import Product from '@/models/Product';
import { normalizeImageUrl } from '@/lib/image-url';
import { requireAdmin } from '@/lib/auth-api';

type ProductRouteContext = { params: Promise<{ id: string }> | { id: string } };

export async function GET(request: Request, context: ProductRouteContext) {
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) return NextResponse.json({ success: false, error: 'পণ্যের আইডি সঠিক নয়।' }, { status: 400 });
    await connectDB();
    const isAdmin = requireAdmin(request) === null;
    const product = await Product.findById(id).select(isAdmin ? '+buyingPrice' : '-buyingPrice').lean();
    if (!product || (!isAdmin && product.isPublic === false)) return NextResponse.json({ success: false, error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    if (!isAdmin) {
      delete product.buyingPrice;
      return NextResponse.json({ success: true, data: product });
    }
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'পণ্য লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: ProductRouteContext) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'পণ্যের আইডি সঠিক নয়।' }, { status: 400 });
    }

    const body = await request.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = String(body.name).trim();
    if (body.description !== undefined) updates.description = String(body.description).trim();
    if (body.category !== undefined) updates.category = String(body.category).trim();
    if (body.regularPrice !== undefined) updates.regularPrice = Number(body.regularPrice);
    if (body.salePrice !== undefined) {
      updates.salePrice = Number(body.salePrice);
      updates.price = Number(body.salePrice);
    } else if (body.price !== undefined) {
      updates.salePrice = Number(body.price);
      updates.price = Number(body.price);
    }
    if (body.stock !== undefined) updates.stock = Number(body.stock);
    const editableFields = ['sku', 'shortDescription', 'subCategory', 'brand', 'sectionIds', 'buyingPrice', 'productType', 'variants', 'inStock', 'isPublic', 'featured', 'freeShipping', 'stockAlert', 'stockAlertThreshold', 'maxOrderQuantity', 'sortingRank', 'seoMetaTitle', 'seoMetaDescription', 'seoKeywords'] as const;
    for (const field of editableFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    if (body.images !== undefined) {
      if (!Array.isArray(body.images) || body.images.length < 1 || body.images.length > 10 || body.images.some((image: unknown) => typeof image !== 'string' || !/^\/uploads\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|gif)$/.test(image))) {
        return NextResponse.json({ success: false, error: '১ থেকে ১০টি বৈধ আপলোড করা ছবি দিন।' }, { status: 400 });
      }
      updates.images = body.images;
      updates.imageUrl = body.images[0];
    } else if (body.imageUrl !== undefined) {
      const imageUrl = normalizeImageUrl(String(body.imageUrl));
      updates.imageUrl = imageUrl;
      updates.images = imageUrl ? [imageUrl] : [];
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ success: false, error: 'আপডেট করার তথ্য পাওয়া যায়নি।' }, { status: 400 });
    }

    if ((updates.name !== undefined && !updates.name) || (updates.description !== undefined && !updates.description) || (updates.category !== undefined && !updates.category)) {
      return NextResponse.json({ success: false, error: 'নাম, বিবরণ ও ক্যাটাগরি খালি রাখা যাবে না।' }, { status: 400 });
    }
    if ((updates.price !== undefined && (!Number.isFinite(Number(updates.price)) || Number(updates.price) <= 0)) || (updates.regularPrice !== undefined && (!Number.isFinite(Number(updates.regularPrice)) || Number(updates.regularPrice) <= 0)) || (updates.salePrice !== undefined && (!Number.isFinite(Number(updates.salePrice)) || Number(updates.salePrice) <= 0))) {
      return NextResponse.json({ success: false, error: 'মূল্য সঠিক নয়; বিক্রয় মূল্য মূল দামের বেশি হতে পারবে না।' }, { status: 400 });
    }
    if (updates.stock !== undefined && (!Number.isInteger(updates.stock) || Number(updates.stock) < 0)) {
      return NextResponse.json({ success: false, error: 'স্টকের পরিমাণ পূর্ণ সংখ্যা হতে হবে।' }, { status: 400 });
    }
    if (updates.buyingPrice !== undefined && (!Number.isFinite(Number(updates.buyingPrice)) || Number(updates.buyingPrice) < 0)) {
      return NextResponse.json({ success: false, error: 'ক্রয়মূল্য শূন্য বা তার বেশি হতে হবে।' }, { status: 400 });
    }
    for (const field of ['stockAlertThreshold', 'maxOrderQuantity'] as const) {
      if (updates[field] !== undefined && (!Number.isInteger(Number(updates[field])) || Number(updates[field]) < 0)) {
        return NextResponse.json({ success: false, error: 'ইনভেন্টরি সীমা শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।' }, { status: 400 });
      }
    }
    if (updates.variants !== undefined) {
      if (!Array.isArray(updates.variants) || updates.variants.some((variant) => {
        if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return true;
        const entry = variant as Record<string, unknown>;
        return !entry.attributes || typeof entry.attributes !== 'object' || Array.isArray(entry.attributes)
          || !Number.isInteger(Number(entry.stock)) || Number(entry.stock) < 0
          || entry.price !== undefined && (!Number.isFinite(Number(entry.price)) || Number(entry.price) <= 0);
      })) return NextResponse.json({ success: false, error: 'ভ্যারিয়েন্টের মূল্য, attributes ও stock সঠিকভাবে দিন।' }, { status: 400 });
    }
    if (updates.sectionIds !== undefined && (!Array.isArray(updates.sectionIds) || updates.sectionIds.some((id) => typeof id !== 'string'))) {
      return NextResponse.json({ success: false, error: 'পণ্য সেকশনের তালিকা সঠিক নয়।' }, { status: 400 });
    }
    for (const field of ['inStock', 'isPublic', 'featured', 'freeShipping', 'stockAlert'] as const) {
      if (updates[field] !== undefined && typeof updates[field] !== 'boolean') return NextResponse.json({ success: false, error: 'দৃশ্যমানতা ও ইনভেন্টরি অপশন সঠিক নয়।' }, { status: 400 });
    }
    if (updates.productType !== undefined && !['single', 'variant'].includes(String(updates.productType))) {
      return NextResponse.json({ success: false, error: 'পণ্যের ধরন সঠিক নয়।' }, { status: 400 });
    }
    if (updates.sortingRank !== undefined && !Number.isFinite(Number(updates.sortingRank))) {
      return NextResponse.json({ success: false, error: 'Sorting Rank সঠিক সংখ্যা হতে হবে।' }, { status: 400 });
    }
    if (updates.imageUrl !== undefined && !updates.imageUrl) {
      return NextResponse.json({ success: false, error: 'সঠিক ছবির URL দিন।' }, { status: 400 });
    }

    await connectDB();
    if (updates.sku) {
      const duplicateSku = await Product.exists({ sku: updates.sku, _id: { $ne: id } });
      if (duplicateSku) return NextResponse.json({ success: false, error: 'এই SKU আগে থেকেই ব্যবহৃত হয়েছে।' }, { status: 409 });
    }
    const existingProduct = await Product.findById(id).select('price salePrice regularPrice productType variants stock');
    if (!existingProduct) return NextResponse.json({ success: false, error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    const finalProductType = updates.productType ?? existingProduct.productType;
    const finalVariants = (updates.variants ?? existingProduct.variants) as { stock: number }[];
    if (finalProductType === 'variant' && (!Array.isArray(finalVariants) || finalVariants.length === 0)) {
      return NextResponse.json({ success: false, error: 'ভ্যারিয়েন্ট পণ্যের জন্য অন্তত একটি ভ্যারিয়েন্ট প্রয়োজন।' }, { status: 400 });
    }
    if (finalProductType === 'variant' && updates.variants !== undefined && updates.stock === undefined) {
      updates.stock = finalVariants.reduce((sum, variant) => sum + Number(variant.stock), 0);
    }
    if (updates.stock !== undefined && (!Number.isInteger(Number(updates.stock)) || Number(updates.stock) < 0)) {
      return NextResponse.json({ success: false, error: 'স্টকের পরিমাণ পূর্ণ সংখ্যা হতে হবে।' }, { status: 400 });
    }
    const resultingSalePrice = Number(updates.salePrice ?? updates.price ?? existingProduct.salePrice ?? existingProduct.price);
    const resultingRegularPrice = Number(updates.regularPrice ?? existingProduct.regularPrice ?? existingProduct.price);
    if (resultingSalePrice > resultingRegularPrice) return NextResponse.json({ success: false, error: 'বিক্রয় মূল্য মূল দামের বেশি হতে পারবে না।' }, { status: 400 });
    const product = await Product.findByIdAndUpdate(id, { $set: updates }, { new: true, runValidators: true });
    if (!product) return NextResponse.json({ success: false, error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: product });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'পণ্য আপডেট করা যায়নি।' }, { status: 500 });
  }
}

export async function PUT(request: Request, context: ProductRouteContext) {
  return PATCH(request, context);
}

export async function DELETE(_request: Request, context: ProductRouteContext) {
  const unauthorized = requireAdmin(_request);
  if (unauthorized) return unauthorized;
  try {
    const { id } = await context.params;
    if (!mongoose.isValidObjectId(id)) {
      return NextResponse.json({ success: false, error: 'পণ্যের আইডি সঠিক নয়।' }, { status: 400 });
    }

    await connectDB();
    const product = await Product.findByIdAndDelete(id);
    if (!product) return NextResponse.json({ success: false, error: 'পণ্যটি পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'পণ্য মুছে ফেলা যায়নি।' }, { status: 500 });
  }
}