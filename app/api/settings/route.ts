import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { normalizeImageUrl } from '@/lib/image-url';
import SiteSetting from '@/models/SiteSetting';
import { requireAdmin } from '@/lib/auth-api';
import { getStoreSettings } from '@/lib/site-settings';
import { ImageUploadValidationError, imageFileFromDataUrl, storeImageFile, validateImageFile } from '@/lib/image-upload';

const DEFAULT_SETTINGS = {
  storeName: 'ঘরবাজার',
  logoUrl: '',
  faviconUrl: '',
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
      faviconUrl: settings.faviconUrl,
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
    console.error('Store Settings Fetch Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'স্টোর সেটিংস লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ success: false, error: 'সেটিংসের তথ্য সঠিক নয়।' }, { status: 400 });
    }
    const payload = body as Record<string, unknown>;
    const updates: Record<string, string> = {};

    for (const field of TEXT_FIELDS) {
      const value = field === 'marqueeText' ? payload.marqueeText ?? payload.announcement_text : payload[field];
      if (value !== undefined) updates[field] = String(value).trim();
    }
    if (updates.marqueeText !== undefined && updates.marqueeText.length > 240) {
      return NextResponse.json({ success: false, error: 'Top Announcement Text সর্বোচ্চ ২৪০ অক্ষরের হতে পারে।' }, { status: 400 });
    }
    for (const field of ['logoUrl', 'faviconUrl', 'heroImageUrl'] as const) {
      if (payload[field] !== undefined) {
        const rawUrl = String(payload[field]).trim();
        if (rawUrl.startsWith('data:image/')) {
          try {
            const imageFile = imageFileFromDataUrl(rawUrl);
            if (!imageFile) return NextResponse.json({ success: false, error: 'ছবির তথ্য সঠিক নয়।' }, { status: 400 });
            const validated = await validateImageFile(imageFile);
            updates[field] = await storeImageFile(validated.bytes, validated.extension);
          } catch (error) {
            if (error instanceof ImageUploadValidationError) {
              return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            }
            throw error;
          }
          continue;
        }
        const normalizedUrl = rawUrl ? normalizeImageUrl(rawUrl) : '';
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
    console.error('Store Settings Update Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'স্টোর সেটিংস সেভ করা যায়নি।' }, { status: 500 });
  }
}