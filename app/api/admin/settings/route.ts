import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import SiteSetting from '@/models/SiteSetting';
import { requireAdmin } from '@/lib/auth-api';
import { normalizeImageUrl } from '@/lib/image-url';
import { getStoreSettings } from '@/lib/site-settings';
import { ImageUploadValidationError, imageFileFromDataUrl, storeImageFile, validateImageFile } from '@/lib/image-upload';

const defaults = {
  storeName: 'ঘরবাজার',
  logoUrl: '',
  heroTitle: 'প্রতিদিনের পছন্দ, এবার আরও সাশ্রয়ে',
  heroSubtitle: 'বিশ্বস্ত পণ্য, ন্যায্য দাম আর দ্রুত ডেলিভারি।',
  heroImageUrl: '',
  promotionLabel: '',
  promotionText: '',
  slogan: '',
  description: '',
  banners: [] as { imageUrl: string; link: string }[],
  primaryColor: '#8c6d3f',
  backgroundColor: '#fdfbf7',
  phone1: '',
  phone2: '',
  whatsapp1: '',
  whatsapp2: '',
  contactEmail: '',
  address: '',
  mapEmbedUrl: '',
  marqueeText: '',
  orderNote: '',
  socialLinks: { facebook: '', instagram: '', youtube: '', tiktok: '' },
  orderSettings: { mobileVerification: false, vpnProtection: false, duplicateOrderBlock: false, duplicateBlockMinutes: 30, locationFields: true, confirmationSms: false, courierProtection: false, courierSuccessRatio: 50 },
  policyPages: {} as Record<string, { title: string; content: string }>,
  pixelSettings: { facebookPixelId: '', facebookAccessToken: '', tiktokPixelId: '', tiktokAccessToken: '', googleAnalyticsId: '', googleTagManagerId: '' },
};

const urlFieldPattern = /^(?:https?:\/\/|\/uploads\/)/i;
const allowedTopLevel = new Set(Object.keys(defaults));

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function validImage(value: unknown) {
  return typeof value === 'string' && (!value || urlFieldPattern.test(value));
}

function validLink(value: string) {
  if (!value) return true;
  if (value.startsWith('/') && !value.startsWith('//')) return true;
  if (value.startsWith('#')) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

async function readSettingsPayload(request: Request): Promise<Record<string, unknown>> {
  if (!request.headers.get('content-type')?.includes('multipart/form-data')) {
    const body: unknown = await request.json();
    if (!isRecord(body)) throw new Error('সেটিংসের তথ্য সঠিক নয়।');
    return body;
  }

  const formData = await request.formData();
  const settingsValue = formData.get('settings');
  if (typeof settingsValue !== 'string') throw new Error('সেটিংসের তথ্য সঠিক নয়।');

  let settings: unknown;
  try {
    settings = JSON.parse(settingsValue);
  } catch {
    throw new Error('সেটিংসের তথ্য সঠিক নয়।');
  }
  if (!isRecord(settings)) throw new Error('সেটিংসের তথ্য সঠিক নয়।');

  const logoImage = formData.get('logoImage');
  if (logoImage !== null && typeof logoImage !== 'string' && !(logoImage instanceof File)) {
    throw new Error('লোগো ছবির ফর্ম ফিল্ড সঠিক নয়।');
  }

  const countValue = formData.get('bannerCount');
  if (typeof countValue !== 'string' || !/^(?:0|[1-9]\d*)$/.test(countValue) || Number(countValue) > 20) {
    throw new Error('সর্বোচ্চ ২০টি ব্যানার যোগ করুন।');
  }
  const banners: { image?: File; imageUrl: string; link: string }[] = [];
  for (let index = 0; index < Number(countValue); index += 1) {
    const image = formData.get(`banners[${index}][image]`);
    const imageUrl = formData.get(`banners[${index}][imageUrl]`);
    const link = formData.get(`banners[${index}][url]`);
    if ((image !== null && typeof image !== 'string' && !(image instanceof File)) ||
        (imageUrl !== null && typeof imageUrl !== 'string') ||
        (link !== null && typeof link !== 'string')) {
      throw new Error('ব্যানারের ছবি বা redirect link সঠিক নয়।');
    }
    banners.push({
      image: image instanceof File && image.size > 0 ? image : undefined,
      imageUrl: typeof imageUrl === 'string' ? imageUrl : '',
      link: typeof link === 'string' ? link : '',
    });
  }

  const unexpectedBannerField = [...formData.keys()].some((key) =>
    key.startsWith('banners[') && !/^banners\[\d+\]\[(?:image|imageUrl|url)\]$/.test(key)
  );
  if (unexpectedBannerField) throw new Error('ব্যানারের ফর্ম ফিল্ড সঠিক নয়।');

  return {
    ...settings,
    ...(logoImage instanceof File && logoImage.size > 0 ? { _logoImage: logoImage } : {}),
    banners,
  };
}

export async function GET(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    await connectDB();
    const current = await getStoreSettings();
    const data = { ...defaults, ...(current || {}) };
    data.banners = Array.isArray(data.banners) ? data.banners : [];
    data.orderSettings = { ...defaults.orderSettings, ...(isRecord(data.orderSettings) ? data.orderSettings : {}) };
    data.policyPages = isRecord(data.policyPages) ? data.policyPages : {};
    data.pixelSettings = { ...defaults.pixelSettings, ...(isRecord(data.pixelSettings) ? data.pixelSettings : {}) };
    return NextResponse.json({ success: true, data });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সেটিংস লোড করা যায়নি।' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;
  try {
    let body: Record<string, unknown>;
    try {
      body = await readSettingsPayload(request);
    } catch (error) {
      return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সেটিংসের তথ্য সঠিক নয়।' }, { status: 400 });
    }
    const updates: Record<string, unknown> = {};
    let logoImage = body._logoImage instanceof File && body._logoImage.size > 0 ? body._logoImage : undefined;
    const announcementText = body.marqueeText ?? body.announcement_text;
    for (const [key, value] of Object.entries(body)) {
      if (key === '_logoImage' || key === 'announcement_text') continue;
      if (!allowedTopLevel.has(key) || key === 'key' || key === '_id') continue;
      updates[key] = value;
    }
    if (updates.marqueeText === undefined && announcementText !== undefined) updates.marqueeText = announcementText;

    if (updates.storeName !== undefined && (typeof updates.storeName !== 'string' || !updates.storeName.trim())) {
      return NextResponse.json({ success: false, error: 'স্টোরের নাম খালি রাখা যাবে না।' }, { status: 400 });
    }
    if (updates.marqueeText !== undefined && (typeof updates.marqueeText !== 'string' || updates.marqueeText.length > 240)) {
      return NextResponse.json({ success: false, error: 'Top Announcement Text সর্বোচ্চ ২৪০ অক্ষরের হতে পারে।' }, { status: 400 });
    }
    const filesToStore: { index: number; bytes: Uint8Array; extension: string }[] = [];
    let pendingBanners: { imageUrl: string; link: string }[] | undefined;
    if (updates.banners !== undefined) {
      if (!Array.isArray(updates.banners) || updates.banners.length > 20) {
        return NextResponse.json({ success: false, error: 'সর্বোচ্চ ২০টি বৈধ ব্যানার ইমেজ ও লিংক দিন।' }, { status: 400 });
      }
      const banners: { imageUrl: string; link: string }[] = [];
      for (const [index, banner] of updates.banners.entries()) {
        if (!isRecord(banner)) {
          return NextResponse.json({ success: false, error: 'প্রতিটি ব্যানারের ছবি ও redirect link সঠিকভাবে দিন।' }, { status: 400 });
        }
        let imageFile = banner.image instanceof File && banner.image.size > 0 ? banner.image : undefined;
        const imageUrl = banner.imageUrl == null ? '' : banner.imageUrl;
        const link = banner.link == null ? '' : banner.link;
        if (typeof imageUrl !== 'string' || typeof link !== 'string' || link.length > 2048 || !validLink(link)) {
          return NextResponse.json({ success: false, error: 'প্রতিটি ব্যানারের ছবি ও redirect link সঠিকভাবে দিন।' }, { status: 400 });
        }
        if (!imageFile && !imageUrl.trim() && !link.trim()) continue;
        if (!imageFile && imageUrl.startsWith('data:image/')) {
          try {
            imageFile = imageFileFromDataUrl(imageUrl);
          } catch (error) {
            if (error instanceof ImageUploadValidationError) {
              return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            }
            throw error;
          }
        }
        if (!imageFile && !validImage(imageUrl)) {
          return NextResponse.json({ success: false, error: 'প্রতিটি ব্যানারের ছবি ও redirect link সঠিকভাবে দিন।' }, { status: 400 });
        }
        if (imageFile) {
          try {
            filesToStore.push({ index, ...await validateImageFile(imageFile) });
          } catch (error) {
            if (error instanceof ImageUploadValidationError) {
              return NextResponse.json({ success: false, error: error.message }, { status: 400 });
            }
            throw error;
          }
        } else if (typeof imageUrl !== 'string' || !imageUrl.trim()) {
          return NextResponse.json({ success: false, error: 'প্রতিটি ব্যানারের জন্য একটি ছবি নির্বাচন করুন।' }, { status: 400 });
        }
        banners.push({ imageUrl: typeof imageUrl === 'string' ? imageUrl.trim() : '', link: link.trim() });
      }
      pendingBanners = banners;
      updates.banners = banners;
    }
    for (const field of ['logoUrl', 'heroImageUrl'] as const) {
      if (updates[field] === null) updates[field] = '';
      if (field === 'logoUrl' && !logoImage && typeof updates.logoUrl === 'string' && updates.logoUrl.startsWith('data:image/')) {
        try {
          logoImage = imageFileFromDataUrl(updates.logoUrl);
        } catch (error) {
          if (error instanceof ImageUploadValidationError) {
            return NextResponse.json({ success: false, error: error.message }, { status: 400 });
          }
          throw error;
        }
      }
      if (field === 'logoUrl' && logoImage) continue;
      if (updates[field] !== undefined && !validImage(updates[field])) return NextResponse.json({ success: false, error: 'লোগো বা ব্যানারের ইমেজ ঠিকানা সঠিক নয়।' }, { status: 400 });
      if (typeof updates[field] === 'string' && updates[field] && !updates[field].startsWith('/uploads/')) {
        const normalized = normalizeImageUrl(updates[field]);
        if (!normalized) return NextResponse.json({ success: false, error: 'শুধু HTTP/HTTPS বা আপলোড করা ইমেজ ঠিকানা ব্যবহার করুন।' }, { status: 400 });
        updates[field] = normalized;
      }
    }
    if (updates.primaryColor !== undefined && (typeof updates.primaryColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(updates.primaryColor))) {
      return NextResponse.json({ success: false, error: 'Primary Color-এর HEX মান সঠিক নয়।' }, { status: 400 });
    }
    if (updates.backgroundColor !== undefined && (typeof updates.backgroundColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(updates.backgroundColor))) {
      return NextResponse.json({ success: false, error: 'Background Color-এর HEX মান সঠিক নয়।' }, { status: 400 });
    }
    if (updates.contactEmail !== undefined && typeof updates.contactEmail === 'string' && updates.contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.contactEmail)) {
      return NextResponse.json({ success: false, error: 'ইমেইল ঠিকানাটি সঠিক নয়।' }, { status: 400 });
    }
    if (updates.mapEmbedUrl !== undefined && (typeof updates.mapEmbedUrl !== 'string' || updates.mapEmbedUrl && !/^https:\/\/(www\.)?(google\.com|maps\.google\.com)\/maps\/embed/i.test(updates.mapEmbedUrl))) {
      return NextResponse.json({ success: false, error: 'Google Maps embed URL সঠিক নয়।' }, { status: 400 });
    }
    if (updates.socialLinks !== undefined && (!isRecord(updates.socialLinks) || Object.values(updates.socialLinks).some((value) => typeof value !== 'string' || value.length > 2048 || !validLink(value)))) {
      return NextResponse.json({ success: false, error: 'সোশ্যাল মিডিয়া লিংকগুলো সঠিক নয়।' }, { status: 400 });
    }
    if (updates.orderSettings !== undefined) {
      const orderSettings = updates.orderSettings;
      if (!isRecord(orderSettings)) return NextResponse.json({ success: false, error: 'Order Settings সঠিক নয়।' }, { status: 400 });
      const toggles = ['mobileVerification', 'vpnProtection', 'duplicateOrderBlock', 'locationFields', 'confirmationSms', 'courierProtection'];
      if (toggles.some((field) => orderSettings[field] !== undefined && typeof orderSettings[field] !== 'boolean')) {
        return NextResponse.json({ success: false, error: 'Order Settings toggle-এর মান boolean হতে হবে।' }, { status: 400 });
      }
      for (const [field, min, max] of [['duplicateBlockMinutes', 1, 10080], ['courierSuccessRatio', 0, 100]] as const) {
        const value = orderSettings[field];
        if (value !== undefined && (!Number.isInteger(Number(value)) || Number(value) < min || Number(value) > max)) {
          return NextResponse.json({ success: false, error: `${field} মান ${min} থেকে ${max} এর মধ্যে হতে হবে।` }, { status: 400 });
        }
      }
    }
    if (updates.policyPages !== undefined) {
      if (!isRecord(updates.policyPages) || Object.entries(updates.policyPages).some(([slug, page]) =>
        !/^[a-z0-9-]{2,64}$/.test(slug) || !isRecord(page) || typeof page.title !== 'string' || page.title.length > 160 || typeof page.content !== 'string' || page.content.length > 50000
      )) return NextResponse.json({ success: false, error: 'Policy page-এর শিরোনাম বা কনটেন্ট সঠিক নয়।' }, { status: 400 });
    }
    if (updates.pixelSettings !== undefined) {
      if (!isRecord(updates.pixelSettings) || Object.entries(updates.pixelSettings).some(([field, value]) =>
        !['facebookPixelId', 'facebookAccessToken', 'tiktokPixelId', 'tiktokAccessToken', 'googleAnalyticsId', 'googleTagManagerId'].includes(field) || typeof value !== 'string' || value.length > 4096
      )) return NextResponse.json({ success: false, error: 'Pixel ও Analytics-এর তথ্য সঠিক নয়।' }, { status: 400 });
    }

    if (logoImage) {
      try {
        const validated = await validateImageFile(logoImage);
        updates.logoUrl = await storeImageFile(validated.bytes, validated.extension);
      } catch (error) {
        if (error instanceof ImageUploadValidationError) {
          return NextResponse.json({ success: false, error: error.message }, { status: 400 });
        }
        throw error;
      }
    }
    if (pendingBanners) {
      for (const { index, bytes, extension } of filesToStore) {
        pendingBanners[index]!.imageUrl = await storeImageFile(bytes, extension);
      }
      updates.banners = pendingBanners;
    }
    if (!Object.keys(updates).length) return NextResponse.json({ success: false, error: 'আপডেট করার কোনো সেটিং পাওয়া যায়নি।' }, { status: 400 });
    await connectDB();
    const settings = await SiteSetting.findOneAndUpdate(
      { key: 'store' },
      { $set: updates, $setOnInsert: { key: 'store' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    return NextResponse.json({ success: true, data: { ...defaults, ...settings } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'সেটিংস সেভ করা যায়নি।' }, { status: 500 });
  }
}
