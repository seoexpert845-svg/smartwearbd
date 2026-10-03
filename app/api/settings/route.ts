import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { normalizeImageUrl } from '@/lib/image-url';
import SiteSetting from '@/models/SiteSetting';
import { requireAdmin } from '@/lib/auth-api';
import { getStoreSettings } from '@/lib/site-settings';

const DEFAULT_SETTINGS = {
  storeName: 'ঘরবাজার',
  logoUrl: '',
  heroTitle: 'প্রতিদিনের পছন্দ, এবার আরও সাশ্রয়ে',
  heroSubtitle: 'বিশ্বস্ত ব্র্যান্ড, ন্যায্য দাম আর দ্রুত ডেলিভারি—আপনার দরজায় পৌঁছে দিচ্ছি আমরা।',
  heroImageUrl: '',
  promotionLabel: 'সাপ্তাহিক শপিং ফেস্ট · ২০২৬',
  promotionText: '৩০% পর্যন্ত ছাড়',
};

const TEXT_FIELDS = ['storeName', 'heroTitle', 'heroSubtitle', 'promotionLabel', 'promotionText', 'marqueeText'] as const;

export async function GET() {
  try {
    await connectDB();
    const settings = await getStoreSettings();
    const displayFields = settings ? {
      storeName: settings.storeName,
      logoUrl: settings.logoUrl,
      heroTitle: settings.heroTitle,
      heroSubtitle: settings.heroSubtitle,
      heroImageUrl: settings.heroImageUrl,
      promotionLabel: settings.promotionLabel,
      promotionText: settings.promotionText,
      slogan: settings.slogan,
      description: settings.description,
      banners: settings.banners,
      deliveryZones: settings.deliveryZones,
      primaryColor: settings.primaryColor,
      backgroundColor: settings.backgroundColor,
      phone1: settings.phone1,
      phone2: settings.phone2,
      whatsapp1: settings.whatsapp1,
      whatsapp2: settings.whatsapp2,
      contactEmail: settings.contactEmail,
      address: settings.address,
      mapEmbedUrl: settings.mapEmbedUrl,
      marqueeText: settings.marqueeText,
      orderNote: settings.orderNote,
      socialLinks: settings.socialLinks,
    } : {};
    return NextResponse.json({ success: true, data: { ...DEFAULT_SETTINGS, ...displayFields } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'স্টোর সেটিংস লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body = await request.json();
    const updates: Record<string, string> = {};

    for (const field of TEXT_FIELDS) {
      const value = field === 'marqueeText' ? body.marqueeText ?? body.announcement_text : body[field];
      if (value !== undefined) updates[field] = String(value).trim();
    }
    if (updates.marqueeText !== undefined && updates.marqueeText.length > 240) {
      return NextResponse.json({ success: false, error: 'Top Announcement Text সর্বোচ্চ ২৪০ অক্ষরের হতে পারে।' }, { status: 400 });
    }
    for (const field of ['logoUrl', 'heroImageUrl'] as const) {
      if (body[field] !== undefined) {
        const rawUrl = String(body[field]).trim();
        const isUploadedLogo = field === 'logoUrl' && /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i.test(rawUrl);
        if (isUploadedLogo && rawUrl.length > 1_400_000) {
          return NextResponse.json({ success: false, error: 'লোগো ছবিটি ১ MB-এর মধ্যে রাখুন।' }, { status: 400 });
        }
        const normalizedUrl = rawUrl ? (isUploadedLogo ? rawUrl : normalizeImageUrl(rawUrl)) : '';
        if (rawUrl && !normalizedUrl) return NextResponse.json({ success: false, error: 'লোগো ও ব্যানারের জন্য সঠিক HTTP/HTTPS URL দিন।' }, { status: 400 });
        updates[field] = normalizedUrl;
      }
    }

    if (Object.keys(updates).length === 0) return NextResponse.json({ success: false, error: 'আপডেট করার কোনো সেটিং পাওয়া যায়নি।' }, { status: 400 });
    if (updates.storeName !== undefined && !updates.storeName) return NextResponse.json({ success: false, error: 'স্টোরের নাম খালি রাখা যাবে না।' }, { status: 400 });
    if (updates.heroTitle !== undefined && !updates.heroTitle) return NextResponse.json({ success: false, error: 'ব্যানারের শিরোনাম খালি রাখা যাবে না।' }, { status: 400 });

    await connectDB();
    const settings = await SiteSetting.findOneAndUpdate(
      { key: 'store' },
      { $set: updates, $setOnInsert: { key: 'store' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return NextResponse.json({ success: true, data: settings });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'স্টোর সেটিংস সেভ করা যায়নি।' }, { status: 500 });
  }
}