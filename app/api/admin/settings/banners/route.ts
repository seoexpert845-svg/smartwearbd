import { NextResponse } from 'next/server';
import connectDB from '@/lib/db';
import { requireAdmin } from '@/lib/auth-api';
import { getStoreSettings } from '@/lib/site-settings';
import SiteSetting from '@/models/SiteSetting';

export async function DELETE(request: Request) {
  try {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const indexValue = new URL(request.url).searchParams.get('index');
    if (!indexValue || !/^\d+$/.test(indexValue)) {
      return NextResponse.json({ success: false, error: 'ব্যানার নির্বাচন সঠিক নয়।' }, { status: 400 });
    }
    const index = Number(indexValue);

    await connectDB();
    const current = await getStoreSettings();
    if (!Array.isArray(current.banners) || index >= current.banners.length) {
      return NextResponse.json({ success: false, error: 'ব্যানারটি পাওয়া যায়নি।' }, { status: 404 });
    }

    const banners = current.banners.filter((_: unknown, currentIndex: number) => currentIndex !== index);
    const settings = await SiteSetting.findOneAndUpdate(
      { key: 'store' },
      { $set: { banners } },
      { new: true, runValidators: true }
    ).lean();

    if (!settings) return NextResponse.json({ success: false, error: 'স্টোর সেটিংস পাওয়া যায়নি।' }, { status: 404 });
    return NextResponse.json({ success: true, data: { banners: settings.banners } });
  } catch (error) {
    console.error('Admin Banner Delete Error:', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'ব্যানার মুছতে ব্যর্থ হয়েছে।' }, { status: 500 });
  }
}
