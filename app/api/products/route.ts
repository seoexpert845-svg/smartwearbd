import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import Product from '@/models/Product';
import { requireAdmin } from '@/lib/auth-api';
import Order from '@/models/Order';

const uploadedImagePattern = /^(?:\/uploads\/[a-zA-Z0-9-]+\.(?:jpg|png|webp|gif)|\/api\/uploads\/[a-f0-9]{24})$/i;

// ১. সব প্রোডাক্ট নিয়ে আসার জন্য (GET Method)
export async function GET(request: Request) {
  try {
    await connectDB();
    const isAdmin = requireAdmin(request) === null;
    const products = await Product.find(isAdmin ? {} : { isPublic: { $ne: false } })
      .select(isAdmin ? '+buyingPrice' : '-buyingPrice')
      .sort(isAdmin ? { createdAt: -1 } : { sortingRank: -1, createdAt: -1 }).lean();
    if (!isAdmin) {
      products.forEach((product) => { delete product.buyingPrice; });
      return NextResponse.json({ success: true, data: products });
    }
    const sales = await Order.aggregate<{ _id: string; unitsSold: number; deliveredUnits: number; netProfit: number }>([
      { $match: { status: 'Delivered' } },
      { $unwind: '$items' },
      { $group: {
        _id: '$items.productId',
        unitsSold: { $sum: '$items.quantity' },
        deliveredUnits: { $sum: '$items.quantity' },
        netProfit: { $sum: { $cond: [
          { $ne: [{ $type: '$items.buyingPrice' }, 'missing'] },
          { $multiply: [{ $subtract: ['$items.price', '$items.buyingPrice'] }, '$items.quantity'] },
          0,
        ] } },
      } },
    ]);
    const salesByProduct = new Map(sales.map((entry) => [entry._id, entry]));
    return NextResponse.json({ success: true, data: products.map((product) => ({
      ...product,
      totalSales: salesByProduct.get(String(product._id))?.unitsSold || 0,
      deliveredUnits: salesByProduct.get(String(product._id))?.deliveredUnits || 0,
      netProfit: salesByProduct.get(String(product._id))?.netProfit || 0,
    })) });
  } catch {
    return NextResponse.json(
      { success: false, error: 'প্রোডাক্ট লোড করতে ব্যর্থ হয়েছে' },
      { status: 500 }
    );
  }
}

// ২. নতুন প্রোডাক্ট ডাটাবেজে যুক্ত করার জন্য (POST Method)
export async function POST(req: Request) {
  const unauthorized = requireAdmin(req);
  if (unauthorized) return unauthorized;
  try {
    const payload: unknown = await req.json();
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return NextResponse.json({ success: false, error: 'প্রোডাক্টের তথ্য সঠিক নয়।' }, { status: 400 });
    }

    const body = payload as Record<string, unknown>;
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    const description = typeof body.description === 'string' ? body.description.trim() : '';
    const category = typeof body.category === 'string' ? body.category.trim() : '';
    const regularPrice = Number(body.regularPrice);
    const salePrice = Number(body.salePrice ?? body.price);
    const stock = body.stock === undefined || body.stock === '' ? 0 : Number(body.stock);
    const buyingPrice = Number(body.buyingPrice ?? 0);
    const stockAlertThreshold = Number(body.stockAlertThreshold ?? 5);
    const maxOrderQuantity = Number(body.maxOrderQuantity ?? 0);
    const sortingRank = Number(body.sortingRank ?? 0);
    const sku = typeof body.sku === 'string' ? body.sku.trim() : '';
    const suppliedImages = Array.isArray(body.images) ? body.images : [];
    const images = suppliedImages.filter((image): image is string => typeof image === 'string' && uploadedImagePattern.test(image));
    const variants = Array.isArray(body.variants) ? body.variants : [];

    if (!name) return NextResponse.json({ success: false, error: 'পণ্যের নাম প্রয়োজন।' }, { status: 400 });
    if (!description) return NextResponse.json({ success: false, error: 'পণ্যের বিবরণ প্রয়োজন।' }, { status: 400 });
    if (!category) return NextResponse.json({ success: false, error: 'পণ্যের ক্যাটাগরি নির্বাচন করুন।' }, { status: 400 });
    if (!Number.isFinite(regularPrice) || regularPrice <= 0) return NextResponse.json({ success: false, error: 'পণ্যের সঠিক মূল মূল্য দিন।' }, { status: 400 });
    if (!Number.isFinite(salePrice) || salePrice <= 0) return NextResponse.json({ success: false, error: 'পণ্যের সঠিক বিক্রয় মূল্য দিন।' }, { status: 400 });
    if (salePrice > regularPrice) return NextResponse.json({ success: false, error: 'বিক্রয় মূল্য মূল দামের বেশি হতে পারবে না।' }, { status: 400 });
    if (!Array.isArray(body.images) || images.length !== suppliedImages.length || images.length < 1 || images.length > 10) {
      return NextResponse.json({ success: false, error: 'পণ্যের জন্য ১ থেকে ১০টি বৈধ ছবি নির্বাচন করুন।' }, { status: 400 });
    }
    if (!Number.isInteger(stock) || stock < 0) return NextResponse.json({ success: false, error: 'স্টকের পরিমাণ শূন্য বা তার বেশি পূর্ণসংখ্যা হতে হবে।' }, { status: 400 });

    const variantsValid = variants.every((variant) => {
      if (!variant || typeof variant !== 'object' || Array.isArray(variant)) return false;
      const entry = variant as Record<string, unknown>;
      return Boolean(entry.attributes && typeof entry.attributes === 'object' && !Array.isArray(entry.attributes)
        && Number.isInteger(Number(entry.stock)) && Number(entry.stock) >= 0
        && (entry.price === undefined || Number.isFinite(Number(entry.price)) && Number(entry.price) > 0));
    });
    if (!Number.isFinite(buyingPrice) || buyingPrice < 0 || !Number.isInteger(stockAlertThreshold) || stockAlertThreshold < 0
      || !Number.isInteger(maxOrderQuantity) || maxOrderQuantity < 0 || !Number.isFinite(sortingRank)
      || body.productType !== undefined && !['single', 'variant'].includes(String(body.productType))
      || body.productType === 'variant' && (!variants.length || !variantsValid)) {
      return NextResponse.json(
        { success: false, error: 'স্টক, ক্রয়মূল্য, ইনভেন্টরি সীমা বা ভ্যারিয়েন্টের তথ্য সঠিক নয়।' },
        { status: 400 }
      );
    }
    await connectDB();
    if (sku && await Product.exists({ sku })) return NextResponse.json({ success: false, error: 'এই SKU আগে থেকেই ব্যবহৃত হয়েছে।' }, { status: 409 });
    const newProduct = await Product.create({
      name,
      ...(sku ? { sku } : {}),
      shortDescription: String(body.shortDescription || '').trim(),
      description,
      price: salePrice,
      regularPrice,
      salePrice,
      category,
      images,
      imageUrl: images[0],
      stock: body.productType === 'variant' ? variants.reduce((sum, variant) => sum + Number((variant as Record<string, unknown>).stock), 0) : stock,
      subCategory: String(body.subCategory || '').trim(),
      brand: String(body.brand || '').trim(),
      sectionIds: Array.isArray(body.sectionIds) ? body.sectionIds.map(String) : [],
      buyingPrice,
      productType: body.productType === 'variant' ? 'variant' : 'single',
      variants,
      inStock: body.inStock !== false,
      isPublic: body.isPublic !== false,
      featured: body.featured === true,
      freeShipping: body.freeShipping === true,
      stockAlert: body.stockAlert === true,
      stockAlertThreshold,
      maxOrderQuantity,
      sortingRank,
      seoMetaTitle: String(body.seoMetaTitle || '').trim(),
      seoMetaDescription: String(body.seoMetaDescription || '').trim(),
      seoKeywords: Array.isArray(body.seoKeywords) ? body.seoKeywords.map(String) : [],
    });

    return NextResponse.json({ success: true, data: newProduct }, { status: 201 });
  } catch (error) {
    console.error("Product Creation Error:", error);
    return NextResponse.json(
      { success: false, message: error instanceof Error ? error.message : "Failed to create product" },
      { status: 500 }
    );
  }
}