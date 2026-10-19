'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ImagePlus, Plus, Save, Settings2, Trash2, X } from 'lucide-react';

type Banner = { imageUrl: string; link: string; file?: File; preview?: string; persisted?: boolean };
type Coupon = { _id: string; code: string; discountType: 'percentage' | 'amount'; discountValue: number; maxDiscount?: number | null; minimumPurchase: number; expiresAt?: string | null; isActive: boolean; redeemedCount?: number };
type StoreSettings = {
  storeName: string; logoUrl: string; faviconUrl: string; heroTitle: string; heroSubtitle: string; heroImageUrl: string;
  promotionLabel: string; promotionText: string; slogan: string; description: string; banners: Banner[];
  primaryColor: string; backgroundColor: string; phone1: string; phone2: string; whatsapp1: string;
  whatsapp2: string; contactEmail: string; address: string; mapEmbedUrl: string; marqueeText: string;
  orderNote: string; socialLinks: Record<string, string>;
  orderSettings: { mobileVerification: boolean; vpnProtection: boolean; duplicateOrderBlock: boolean; duplicateBlockMinutes: number; locationFields: boolean; confirmationSms: boolean; courierProtection: boolean; courierSuccessRatio: number };
  policyPages: Record<string, { title: string; content: string }>;
  pixelSettings: { facebookPixelId: string; facebookAccessToken: string; tiktokPixelId: string; tiktokAccessToken: string; googleAnalyticsId: string; googleTagManagerId: string };
};

const tabs = [
  { href: '/admin/settings/web', label: 'Web Settings' },
  { href: '/admin/settings/order', label: 'Order Settings' },
  { href: '/admin/settings/coupons', label: 'Coupons' },
  { href: '/admin/settings/pages', label: 'Page Settings' },
  { href: '/admin/settings/pixel', label: 'Pixel Settings' },
];
const pageList = [
  ['privacy-policy', 'Privacy Policy'], ['terms-and-conditions', 'Terms & Conditions'],
  ['return-policy', 'Return Policy'], ['refund-policy', 'Refund Policy'], ['about-us', 'About Us'],
  ['delivery-policy', 'Delivery Policy'], ['contact-us', 'Contact Us'],
];
const defaults: StoreSettings = {
  storeName: 'ঘরবাজার', logoUrl: '', faviconUrl: '', heroTitle: 'প্রতিদিনের পছন্দ, এবার আরও সাশ্রয়ে',
  heroSubtitle: 'বিশ্বস্ত পণ্য, ন্যায্য দাম আর দ্রুত ডেলিভারি।', heroImageUrl: '', promotionLabel: '',
  promotionText: '', slogan: '', description: '', banners: [], primaryColor: '#8c6d3f',
  backgroundColor: '#fdfbf7', phone1: '', phone2: '', whatsapp1: '', whatsapp2: '', contactEmail: '',
  address: '', mapEmbedUrl: '', marqueeText: '', orderNote: '',
  socialLinks: { facebook: '', instagram: '', youtube: '', tiktok: '' },
  orderSettings: { mobileVerification: false, vpnProtection: false, duplicateOrderBlock: false, duplicateBlockMinutes: 30, locationFields: true, confirmationSms: false, courierProtection: false, courierSuccessRatio: 50 },
  policyPages: {}, pixelSettings: { facebookPixelId: '', facebookAccessToken: '', tiktokPixelId: '', tiktokAccessToken: '', googleAnalyticsId: '', googleTagManagerId: '' },
};
const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal text-stone-900 outline-none transition focus:border-teal-700 focus:ring-2 focus:ring-teal-700/10';
const money = (amount: number) => `৳${new Intl.NumberFormat('en-US').format(amount)}`;

async function compressBannerImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  try {
    const maxDimension = 1920;
    const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
    let width = Math.max(1, Math.round(bitmap.width * scale));
    let height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement('canvas');

    for (let attempt = 0; attempt < 8; attempt += 1) {
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d');
      if (!context) throw new Error('ব্যানার ছবি প্রস্তুত করা যায়নি।');
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((result) => result ? resolve(result) : reject(new Error('ব্যানার ছবি কমপ্রেস করা যায়নি।')), 'image/webp', Math.max(0.4, 0.8 - attempt * 0.06));
      });
      if (blob.size <= 900_000) {
        const name = file.name.replace(/\.[^.]+$/, '') || 'banner';
        const extension = blob.type === 'image/webp' ? '.webp' : '.jpg';
        return new File([blob], `${name}${extension}`, { type: blob.type, lastModified: Date.now() });
      }
      width = Math.max(1, Math.round(width * 0.85));
      height = Math.max(1, Math.round(height * 0.85));
    }
    throw new Error('কমপ্রেস করার পরও ব্যানারটি ৯০০ KB-এর বেশি। ছোট ছবি ব্যবহার করুন।');
  } finally {
    bitmap.close();
  }
}

async function readApiJson(response: Response) {
  try {
    const result: unknown = await response.json();
    if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error('Invalid API response');
    return result as Record<string, unknown>;
  } catch {
    throw new Error(response.status === 413
      ? 'ছবির ফাইলটি সার্ভারের অনুমোদিত সীমার চেয়ে বড়। ছোট ছবি আপলোড করুন।'
      : 'সার্ভার থেকে সঠিক JSON উত্তর পাওয়া যায়নি। আবার চেষ্টা করুন।');
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readStringRecord(value: unknown): Record<string, string> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

function readPolicyPages(value: unknown): StoreSettings['policyPages'] {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).flatMap(([slug, page]) =>
    isRecord(page) && typeof page.title === 'string' && typeof page.content === 'string'
      ? [[slug, { title: page.title, content: page.content }]]
      : []
  ));
}

async function uploadAdminImage(file: File, compress = false) {
  const uploadFile = compress ? await compressBannerImage(file) : file;
  const formData = new FormData();
  formData.append('settingsImage', uploadFile);
  const response = await fetch('/api/uploads', { method: 'POST', body: formData });
  const result = await readApiJson(response);
  const data = result.data;
  if (!response.ok || result.success !== true || !Array.isArray(data) || typeof data[0] !== 'string') {
    throw new Error(typeof result.message === 'string' ? result.message : typeof result.error === 'string' ? result.error : 'ছবি আপলোড করা যায়নি।');
  }
  return data[0];
}

function Notice({ kind, children }: { kind: 'error' | 'success'; children: React.ReactNode }) {
  return <motion.p initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} role={kind === 'error' ? 'alert' : 'status'} className={`mb-4 rounded-lg border p-3 text-sm font-medium ${kind === 'error' ? 'border-red-200 bg-red-50 text-red-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{children}</motion.p>;
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return <motion.section layout initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7"><header className="mb-5 border-b border-stone-100 pb-4"><h2 className="font-extrabold text-stone-900">{title}</h2>{description && <p className="mt-1 text-xs leading-5 text-stone-600">{description}</p>}</header>{children}</motion.section>;
}

function Toggle({ label, checked, onChange, detail }: { label: string; checked: boolean; onChange: (checked: boolean) => void; detail?: string }) {
  return <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-stone-200 bg-white p-4 transition hover:border-teal-300 hover:bg-teal-50/40"><span><strong className="block text-sm text-stone-900">{label}</strong>{detail && <small className="mt-1 block text-xs text-stone-600">{detail}</small>}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="peer sr-only" /><span aria-hidden="true" className={`relative h-6 w-11 shrink-0 rounded-full transition-colors after:absolute after:left-1 after:top-1 after:size-4 after:rounded-full after:bg-white after:shadow after:transition-transform ${checked ? 'bg-teal-700 after:translate-x-5' : 'bg-stone-300'}`} /></label>;
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return <motion.div className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-slate-950/55 p-4 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><motion.div initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.98 }} transition={{ duration: 0.2 }} className="my-auto w-full max-w-xl rounded-2xl border border-white/30 bg-white p-5 shadow-2xl sm:p-7">{children}</motion.div></motion.div>;
}

export default function AdminSettingsModule() {
  const pathname = usePathname();
  const activeTab = tabs.find((tab) => pathname === tab.href)?.href || '/admin/settings/web';
  const [settings, setSettings] = useState<StoreSettings>(defaults);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const saveInProgress = useRef(false);
  const [deletingBannerIndex, setDeletingBannerIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [faviconFile, setFaviconFile] = useState<File | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [couponModal, setCouponModal] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponForm, setCouponForm] = useState({ code: '', discountType: 'percentage' as 'percentage' | 'amount', discountValue: '', maxDiscount: '', minimumPurchase: '', expiresAt: '', isActive: true });
  const [selectedPage, setSelectedPage] = useState(pageList[0][0]);

  useEffect(() => {
    let active = true;
    fetch('/api/admin/settings').then(async (response) => {
      const result = await readApiJson(response);
      if (!response.ok || result.success !== true) throw new Error(typeof result.error === 'string' ? result.error : 'সেটিংস লোড করা যায়নি।');
      const data = result.data;
      if (!isRecord(data)) throw new Error('সেটিংসের তথ্য পাওয়া যায়নি।');
      if (active) setSettings({
        ...defaults,
        ...data,
        socialLinks: { ...defaults.socialLinks, ...readStringRecord(data.socialLinks) },
        orderSettings: { ...defaults.orderSettings, ...(isRecord(data.orderSettings) ? data.orderSettings : {}) },
        pixelSettings: { ...defaults.pixelSettings, ...(isRecord(data.pixelSettings) ? data.pixelSettings : {}) },
        policyPages: readPolicyPages(data.policyPages),
        banners: Array.isArray(data.banners)
          ? data.banners.filter(isRecord)
            .map((banner) => ({ imageUrl: typeof banner.imageUrl === 'string' ? banner.imageUrl : '', link: typeof banner.link === 'string' ? banner.link : '', persisted: true }))
          : [],
      });
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'সেটিংস লোড করা যায়নি।'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!settings.faviconUrl) return;
    let favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    if (!favicon) {
      favicon = document.createElement('link');
      favicon.rel = 'icon';
      document.head.append(favicon);
    }
    favicon.href = settings.faviconUrl;
  }, [settings.faviconUrl]);

  useEffect(() => {
    if (activeTab !== '/admin/settings/coupons') return;
    let active = true;
    fetch('/api/coupons').then(async (response) => {
      const result = await readApiJson(response);
      if (!response.ok || result.success !== true) throw new Error(typeof result.error === 'string' ? result.error : 'কুপন লোড করা যায়নি।');
      if (!Array.isArray(result.data)) throw new Error('কুপনের তথ্য পাওয়া যায়নি।');
      if (active) setCoupons(result.data as Coupon[]);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'কুপন লোড করা যায়নি।'); });
    return () => { active = false; };
  }, [activeTab]);

  const updateSetting = <K extends keyof StoreSettings>(key: K, value: StoreSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const updateNested = <K extends ('socialLinks' | 'orderSettings' | 'policyPages' | 'pixelSettings'),>(key: K, value: StoreSettings[K]) => setSettings((current) => ({ ...current, [key]: value }));
  const showToast = (message: string) => { setToast(message); window.setTimeout(() => setToast(''), 2800); };

  const saveSettings = async (patch: Partial<StoreSettings> = settings) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/admin/settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(patch) });
      const result = await readApiJson(response);
      if (!response.ok || result.success !== true) throw new Error(typeof result.error === 'string' ? result.error : 'সেটিংস সেভ করা যায়নি।');
      if (!isRecord(result.data)) throw new Error('সেটিংস সেভ হয়েছে, তবে সার্ভারের উত্তর সঠিক নয়।');
      const savedData = result.data;
      setSettings((current) => ({ ...current, ...savedData }));
      window.dispatchEvent(new Event('store-settings-updated'));
      showToast('Settings saved successfully');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'সেটিংস সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const addBanner = () => updateSetting('banners', [...settings.banners, { imageUrl: '', link: '', persisted: false }]);
  const setBanner = (index: number, patch: Partial<Banner>) => updateSetting('banners', settings.banners.map((banner, currentIndex) => currentIndex === index ? { ...banner, ...patch } : banner));
  const removeBanner = async (index: number) => {
    const banner = settings.banners[index];
    if (!banner) return;
    if (!banner.persisted) {
      updateSetting('banners', settings.banners.filter((_, currentIndex) => currentIndex !== index));
      return;
    }

    setDeletingBannerIndex(index);
    setError('');
    try {
      const response = await fetch(`/api/admin/settings/banners?index=${index}`, { method: 'DELETE' });
      const result = await readApiJson(response);
      if (!response.ok || result.success !== true) throw new Error(typeof result.error === 'string' ? result.error : 'ব্যানার মুছতে ব্যর্থ হয়েছে।');
      setSettings((current) => ({ ...current, banners: current.banners.filter((_, currentIndex) => currentIndex !== index) }));
      window.dispatchEvent(new Event('store-settings-updated'));
      showToast('Banner deleted');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ব্যানার মুছতে ব্যর্থ হয়েছে।');
    } finally {
      setDeletingBannerIndex(null);
    }
  };

  const saveWebSettings = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (saveInProgress.current) return;
    saveInProgress.current = true;
    setSaving(true);
    setError('');
    try {
      const nextSettings = { ...settings };
      const { banners: currentBanners, ...settingsPayload } = nextSettings;
      const banners: { imageUrl: string; link: string }[] = [];
      const bannersToSave = currentBanners.filter((entry) => entry.file || entry.imageUrl.trim());
      for (let offset = 0; offset < bannersToSave.length; offset += 3) {
        const batch = bannersToSave.slice(offset, offset + 3);
        const uploaded = await Promise.all(batch.map(async (banner) => ({
          imageUrl: banner.file ? await uploadAdminImage(banner.file, true) : banner.imageUrl,
          link: banner.link?.trim() || '',
        })));
        banners.push(...uploaded);
      }
      const [logoUrl, faviconUrl] = await Promise.all([
        logoFile ? uploadAdminImage(logoFile, true) : Promise.resolve(settingsPayload.logoUrl),
        faviconFile ? uploadAdminImage(faviconFile, true) : Promise.resolve(settingsPayload.faviconUrl),
      ]);
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...settingsPayload, logoUrl, faviconUrl, banners }),
      });
      const result = await readApiJson(response);
      if (!response.ok || result.success !== true || !result.data || typeof result.data !== 'object') {
        throw new Error(typeof result.error === 'string' ? result.error : 'ওয়েব সেটিংস সেভ করা যায়নি।');
      }
      const savedSettings = result.data as Partial<StoreSettings>;
      const savedBanners = Array.isArray(savedSettings.banners)
        ? savedSettings.banners.filter((banner): banner is Banner => Boolean(banner) && typeof banner === 'object')
          .map((banner) => ({ imageUrl: typeof banner.imageUrl === 'string' ? banner.imageUrl : '', link: typeof banner.link === 'string' ? banner.link : '', persisted: true }))
        : [];
      setSettings({ ...settings, ...savedSettings, banners: savedBanners });
      setLogoFile(null);
      setFaviconFile(null);
      window.dispatchEvent(new Event('store-settings-updated'));
      showToast('Web settings saved');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ওয়েব সেটিংস সেভ করা যায়নি।');
    } finally {
      saveInProgress.current = false;
      setSaving(false);
    }
  };

  const syncOrderSettings = async (patch: Partial<StoreSettings['orderSettings']>) => {
    const orderSettings = { ...settings.orderSettings, ...patch };
    updateNested('orderSettings', orderSettings);
    await saveSettings({ orderSettings });
  };

  const openCoupon = (coupon?: Coupon) => {
    setEditingCoupon(coupon || null);
    setCouponForm(coupon ? {
      code: coupon.code, discountType: coupon.discountType, discountValue: String(coupon.discountValue),
      maxDiscount: coupon.maxDiscount == null ? '' : String(coupon.maxDiscount), minimumPurchase: String(coupon.minimumPurchase || ''),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().slice(0, 16) : '', isActive: coupon.isActive,
    } : { code: '', discountType: 'percentage', discountValue: '', maxDiscount: '', minimumPurchase: '', expiresAt: '', isActive: true });
    setError('');
    setCouponModal(true);
  };

  const saveCoupon = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCouponBusy(true);
    setError('');
    try {
      const response = await fetch(editingCoupon ? `/api/coupons/${editingCoupon._id}` : '/api/coupons', {
        method: editingCoupon ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...couponForm, discountValue: Number(couponForm.discountValue), maxDiscount: couponForm.maxDiscount ? Number(couponForm.maxDiscount) : null, minimumPurchase: Number(couponForm.minimumPurchase || 0), expiresAt: couponForm.expiresAt ? new Date(couponForm.expiresAt).toISOString() : null }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'কুপন সেভ করা যায়নি।');
      setCoupons((current) => editingCoupon ? current.map((coupon) => coupon._id === editingCoupon._id ? result.data : coupon) : [result.data, ...current]);
      setCouponModal(false);
      showToast('Coupon saved');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'কুপন সেভ করা যায়নি।');
    } finally {
      setCouponBusy(false);
    }
  };

  const deleteCoupon = async (coupon: Coupon) => {
    if (!window.confirm(`${coupon.code} কুপনটি মুছে ফেলবেন?`)) return;
    const response = await fetch(`/api/coupons/${coupon._id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) return setError(result.error || 'কুপন মুছতে ব্যর্থ হয়েছে।');
    setCoupons((current) => current.filter((item) => item._id !== coupon._id));
    showToast('Coupon deleted');
  };

  const couponStats = useMemo(() => {
    const active = coupons.filter((coupon) => coupon.isActive && (!coupon.expiresAt || new Date(coupon.expiresAt) > new Date())).length;
    return { total: coupons.length, active, expired: coupons.filter((coupon) => coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()).length };
  }, [coupons]);
  const pageValue = settings.policyPages[selectedPage] || { title: pageList.find(([slug]) => slug === selectedPage)?.[1] || '', content: '' };

  return <main className="admin-settings-module mx-auto max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Store configuration</p><h1 className="mt-1 text-2xl font-black text-stone-900 sm:text-3xl">Settings Module</h1><p className="mt-1 text-sm text-stone-600">স্টোর, অর্ডার, কুপন, পেজ ও অ্যানালিটিক্স কনফিগার করুন।</p></div><span className="inline-flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs font-bold text-teal-900"><Settings2 className="size-3.5" />Admin settings</span></header>
    <nav aria-label="Settings sections" className="mb-6 flex gap-1 overflow-x-auto rounded-2xl border border-stone-200 bg-white p-1.5 shadow-sm">{tabs.map((tab) => <Link key={tab.href} href={tab.href} className={`relative shrink-0 rounded-xl px-4 py-3 text-sm font-bold transition-colors ${activeTab === tab.href ? 'text-white' : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'}`}>{activeTab === tab.href && <motion.span layoutId="settings-active-tab" className="absolute inset-0 rounded-xl bg-[#123d3a]" transition={{ type: 'spring', stiffness: 380, damping: 32 }} />}<span className="relative z-10">{tab.label}</span></Link>)}</nav>
    {error && <Notice kind="error">{error}</Notice>}
    {loading ? <div className="rounded-2xl border border-stone-200 bg-white p-8 text-sm text-stone-600">সেটিংস লোড হচ্ছে...</div> : <AnimatePresence mode="wait">
      <motion.div key={activeTab} initial={{ opacity: 0, y: 9 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} transition={{ duration: 0.18 }}>
        {activeTab === '/admin/settings/web' &&         <form encType="multipart/form-data" onSubmit={saveWebSettings} className="space-y-5">
          <Section title="General Info" description="স্টোরের নাম, পরিচিতি, লোগো ও favicon নির্ধারণ করুন।"><div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold text-stone-800 sm:col-span-2">Site Name<input required maxLength={120} value={settings.storeName} onChange={(event) => updateSetting('storeName', event.target.value)} className={fieldClass} /></label><label className="block text-sm font-semibold text-stone-800">Site Slogan / Sub-Logo Text<input maxLength={240} value={settings.slogan} onChange={(event) => updateSetting('slogan', event.target.value)} className={fieldClass} /></label><label className="block text-sm font-semibold text-stone-800">Description<input maxLength={500} value={settings.description} onChange={(event) => updateSetting('description', event.target.value)} className={fieldClass} /></label><div className="flex flex-wrap items-center gap-4 sm:col-span-2"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-4 text-sm font-bold text-stone-800 transition hover:border-teal-700"><ImagePlus className="size-4" />Upload logo<input type="file" name="logoImage" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) setLogoFile(file); }} className="sr-only" /></label><p className="text-xs text-stone-600">JPG, PNG, WEBP বা GIF · সর্বোচ্চ ৪ MB</p>{(logoFile || settings.logoUrl) && <img src={logoFile ? URL.createObjectURL(logoFile) : settings.logoUrl} alt="Logo preview" className="size-16 rounded-xl border border-stone-200 bg-stone-50 object-contain p-2" />}</div><div className="flex flex-wrap items-center gap-4 sm:col-span-2"><label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-4 text-sm font-bold text-stone-800 transition hover:border-teal-700"><ImagePlus className="size-4" />Upload favicon<input type="file" name="faviconImage" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) setFaviconFile(file); }} className="sr-only" /></label><p className="text-xs text-stone-600">JPG, PNG, WEBP বা GIF · সর্বোচ্চ ৪ MB</p>{(faviconFile || settings.faviconUrl) && <img src={faviconFile ? URL.createObjectURL(faviconFile) : settings.faviconUrl} alt="Favicon preview" className="size-12 rounded-lg border border-stone-200 bg-stone-50 object-contain p-2" />}</div></div></Section>
          <Section title="Banners Management" description="প্রতিটি ব্যানারের জন্য ছবি এবং আলাদা click-through URL দিন।">
            <div className="grid gap-4 md:grid-cols-2">{settings.banners.map((banner, index) => <motion.article layout key={`banner-${index}`} className="relative rounded-xl border border-stone-200 bg-stone-50 p-4"><button type="button" onClick={() => void removeBanner(index)} disabled={saving || deletingBannerIndex !== null} aria-label="Remove banner" className="absolute right-2 top-2 z-10 grid size-8 place-items-center rounded-full bg-red-600 text-white shadow transition hover:scale-105 hover:bg-red-700 disabled:cursor-wait disabled:opacity-60"><X className="size-4" /></button><label className="flex min-h-36 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-lg border-2 border-dashed border-stone-300 bg-white text-center text-sm font-semibold text-stone-700 transition hover:border-teal-600">{banner.file || banner.imageUrl ? <img src={banner.preview || banner.imageUrl} alt={`Banner ${index + 1}`} className="h-36 w-full object-cover" /> : <><ImagePlus className="mb-2 size-6 text-teal-700" />Banner Image {index + 1}</>}<input type="file" name={`banners[${index}][image]`} accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { const file = event.target.files?.[0]; if (file) setBanner(index, { file, preview: URL.createObjectURL(file) }); }} className="sr-only" /></label><input type="hidden" name={`banners[${index}][imageUrl]`} value={banner.imageUrl} /><label className="mt-3 block text-xs font-bold text-stone-700">Dynamic Redirect Link<input type="text" maxLength={2048} name={`banners[${index}][url]`} placeholder="https://example.com/offer or #products" value={banner.link} onChange={(event) => setBanner(index, { link: event.target.value })} className={fieldClass} /></label></motion.article>)}<motion.button layout type="button" onClick={addBanner} disabled={settings.banners.length >= 20} className="flex min-h-48 flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 text-sm font-bold text-teal-900 transition hover:border-teal-600 hover:bg-teal-50 disabled:opacity-50"><Plus className="size-6" />Add Banner</motion.button></div>
          </Section>
          <Section title="Theme Customization" description="রং পরিবর্তন করলে স্টোরফ্রন্টের theme variables live preview-তে আপডেট হবে।"><div className="grid gap-4 sm:grid-cols-2"><ColorPicker label="Primary Color" value={settings.primaryColor} onChange={(value) => updateSetting('primaryColor', value)} /><ColorPicker label="Background Color" value={settings.backgroundColor} onChange={(value) => updateSetting('backgroundColor', value)} /></div><div className="mt-4 rounded-xl border p-5 transition-colors" style={{ background: settings.backgroundColor, borderColor: settings.primaryColor }}><p className="text-xs font-bold uppercase tracking-widest" style={{ color: settings.primaryColor }}>Live store preview</p><h3 className="mt-2 text-xl font-black" style={{ color: settings.primaryColor }}>{settings.storeName || 'Your Store'}</h3><p className="mt-1 text-sm text-stone-700">{settings.slogan || 'Your brand slogan will appear here.'}</p><button type="button" className="mt-4 rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: settings.primaryColor }}>Shop Now</button></div></Section>
          <Section title="Contact Information"><div className="grid gap-4 sm:grid-cols-2"><TextField label="Phone 1" value={settings.phone1} onChange={(value) => updateSetting('phone1', value)} /><TextField label="Phone 2" value={settings.phone2} onChange={(value) => updateSetting('phone2', value)} /><TextField label="WhatsApp 1" value={settings.whatsapp1} onChange={(value) => updateSetting('whatsapp1', value)} /><TextField label="WhatsApp 2" value={settings.whatsapp2} onChange={(value) => updateSetting('whatsapp2', value)} /><TextField label="Email" type="email" value={settings.contactEmail} onChange={(value) => updateSetting('contactEmail', value)} /><TextField label="Map Embed URL" type="url" value={settings.mapEmbedUrl} onChange={(value) => updateSetting('mapEmbedUrl', value)} /><label className="block text-sm font-semibold text-stone-800 sm:col-span-2">Address<textarea rows={2} value={settings.address} onChange={(event) => updateSetting('address', event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-teal-700" /></label>{settings.mapEmbedUrl && <iframe title="Store map preview" src={settings.mapEmbedUrl} loading="lazy" referrerPolicy="no-referrer-when-downgrade" className="h-52 w-full rounded-xl border border-stone-200 sm:col-span-2" />}</div></Section>
          <Section title="Notices & Announcements"><div className="grid gap-4"><TextField label="Top Announcement Text / Notice Text" value={settings.marqueeText} onChange={(value) => updateSetting('marqueeText', value)} /><label className="block text-sm font-semibold text-stone-800">Order Note<textarea rows={3} value={settings.orderNote} onChange={(event) => updateSetting('orderNote', event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal" /></label></div></Section>
          <Section title="Social Media Links"><div className="grid gap-4 sm:grid-cols-2">{(['facebook', 'instagram', 'youtube', 'tiktok'] as const).map((network) => <TextField key={network} label={network[0]!.toUpperCase() + network.slice(1)} type="url" value={settings.socialLinks[network] || ''} onChange={(value) => updateNested('socialLinks', { ...settings.socialLinks, [network]: value })} />)}</div></Section>
          <button type="submit" disabled={saving} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#123d3a] px-6 text-sm font-bold text-white shadow-sm transition hover:scale-[1.02] hover:bg-[#0c302d] disabled:cursor-wait disabled:opacity-60"><Save className="size-4" />{saving ? 'Saving...' : 'Save Web Settings'}</button>
          <PasswordSettings fieldClass={fieldClass} />
        </form>}
        {activeTab === '/admin/settings/order' && <div className="space-y-5"><Section title="Order protection & checkout" description="Switch updates are sent to the backend immediately. They are configuration flags; OTP/VPN/SMS enforcement needs a configured provider/integration."><div className="grid gap-3 lg:grid-cols-2"><Toggle label="Mobile Number Verification" detail="Require OTP/SMS verification before order placement." checked={settings.orderSettings.mobileVerification} onChange={(checked) => void syncOrderSettings({ mobileVerification: checked })} /><Toggle label="VPN Protection" detail="Enable VPN risk checking before accepting new orders." checked={settings.orderSettings.vpnProtection} onChange={(checked) => void syncOrderSettings({ vpnProtection: checked })} /><Toggle label="Duplicate Order Block" detail="Block repeat attempts from the same customer during the selected time window." checked={settings.orderSettings.duplicateOrderBlock} onChange={(checked) => void syncOrderSettings({ duplicateOrderBlock: checked })} /><label className="block rounded-xl border border-stone-200 bg-white p-4 text-sm font-semibold text-stone-800">Order Block Time (minutes)<input type="number" min="1" max="10080" value={settings.orderSettings.duplicateBlockMinutes} onChange={(event) => updateNested('orderSettings', { ...settings.orderSettings, duplicateBlockMinutes: Number(event.target.value) })} onBlur={() => void syncOrderSettings({ duplicateBlockMinutes: settings.orderSettings.duplicateBlockMinutes })} className={fieldClass} /></label><Toggle label="Location Fields" detail="Require District and Upazila selection on checkout." checked={settings.orderSettings.locationFields} onChange={(checked) => void syncOrderSettings({ locationFields: checked })} /><Toggle label="Order Confirmation SMS" detail="Send a confirmation message after a successful order." checked={settings.orderSettings.confirmationSms} onChange={(checked) => void syncOrderSettings({ confirmationSms: checked })} /><Toggle label="Courier Protection" detail="Reject customer phones below the configured delivery success ratio." checked={settings.orderSettings.courierProtection} onChange={(checked) => void syncOrderSettings({ courierProtection: checked })} /><label className="block rounded-xl border border-stone-200 bg-white p-4 text-sm font-semibold text-stone-800">Success Ratio (%)<input type="number" min="0" max="100" value={settings.orderSettings.courierSuccessRatio} onChange={(event) => updateNested('orderSettings', { ...settings.orderSettings, courierSuccessRatio: Number(event.target.value) })} onBlur={() => void syncOrderSettings({ courierSuccessRatio: settings.orderSettings.courierSuccessRatio })} className={fieldClass} /></label></div></Section><button type="button" disabled={saving} onClick={() => void saveSettings({ orderSettings: settings.orderSettings })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123d3a] px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="size-4" />Save Order Settings</button></div>}
        {activeTab === '/admin/settings/coupons' && <div><div className="mb-5 flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-extrabold text-stone-900">Coupons Management</h2><p className="mt-1 text-sm text-stone-600">Discount codes, eligibility constraints and expiry controls.</p></div><button type="button" onClick={() => openCoupon()} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#123d3a] px-4 text-sm font-bold text-white transition hover:scale-[1.02]"><Plus className="size-4" />Add Coupon</button></div><div className="mb-5 grid gap-3 sm:grid-cols-3">{[['Total Coupons', couponStats.total, 'bg-slate-50'], ['Active Coupons', couponStats.active, 'bg-emerald-50'], ['Expired Coupons', couponStats.expired, 'bg-amber-50']].map(([label, value, color]) => <div key={String(label)} className={`rounded-2xl border border-stone-200 p-5 ${color}`}><p className="text-xs font-bold uppercase tracking-wide text-stone-600">{label}</p><p className="mt-2 text-3xl font-black text-stone-900">{value}</p></div>)}</div><div className="overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="w-full min-w-[780px] text-left text-sm"><thead className="bg-stone-50 text-xs font-bold uppercase text-stone-600"><tr><th className="px-4 py-3">Code</th><th className="px-4 py-3">Discount</th><th className="px-4 py-3">Expiry Date</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Actions</th></tr></thead><tbody className="divide-y divide-stone-100">{coupons.map((coupon) => { const expired = Boolean(coupon.expiresAt && new Date(coupon.expiresAt) <= new Date()); return <tr key={coupon._id} className="transition-colors hover:bg-stone-50"><td className="px-4 py-3 font-mono font-bold">{coupon.code}</td><td className="px-4 py-3">{coupon.discountType === 'percentage' ? `${coupon.discountValue}%` : money(coupon.discountValue)}{coupon.maxDiscount ? <span className="block text-xs text-stone-600">Max {money(coupon.maxDiscount)}</span> : null}</td><td className="px-4 py-3 text-stone-700">{coupon.expiresAt ? new Date(coupon.expiresAt).toLocaleString() : 'No expiry'}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${coupon.isActive && !expired ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{expired ? 'Expired' : coupon.isActive ? 'Active' : 'Inactive'}</span></td><td className="px-4 py-3">{coupon.redeemedCount || 0}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => openCoupon(coupon)} className="rounded border border-stone-300 px-3 py-2 text-xs font-bold hover:border-teal-700">Edit</button><button type="button" onClick={() => void deleteCoupon(coupon)} aria-label={`Delete ${coupon.code}`} className="grid size-8 place-items-center rounded border border-red-200 text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button></div></td></tr>; })}{coupons.length === 0 && <tr><td colSpan={6} className="px-4 py-12 text-center text-stone-600">No coupons yet. Add a coupon to get started.</td></tr>}</tbody></table></div></div>}
        {activeTab === '/admin/settings/pages' && <div className="space-y-5"><Section title="Page Settings" description="Edit policy and information pages. Content is stored as plain text with Markdown-style formatting."><div className="flex flex-wrap gap-2" role="tablist" aria-label="Pages">{pageList.map(([slug, title]) => <button key={slug} type="button" role="tab" aria-selected={selectedPage === slug} onClick={() => setSelectedPage(slug)} className={`rounded-full border px-3 py-2 text-xs font-bold transition ${selectedPage === slug ? 'border-teal-800 bg-teal-800 text-white' : 'border-stone-200 bg-white text-stone-700 hover:bg-stone-50'}`}>{title}</button>)}</div><div className="mt-5 grid gap-4"><TextField label="Page Title" value={pageValue.title} onChange={(title) => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, title } })} /><div><div className="mb-2 flex flex-wrap gap-2"><button type="button" onClick={() => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, content: `${pageValue.content}**Bold text**` } })} className="rounded border border-stone-300 px-3 py-1.5 text-xs font-bold">Bold</button><button type="button" onClick={() => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, content: `${pageValue.content}*Italic text*` } })} className="rounded border border-stone-300 px-3 py-1.5 text-xs italic">Italic</button><button type="button" onClick={() => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, content: `${pageValue.content}\n- List item` } })} className="rounded border border-stone-300 px-3 py-1.5 text-xs">List</button><button type="button" onClick={() => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, content: `${pageValue.content}\n## Heading` } })} className="rounded border border-stone-300 px-3 py-1.5 text-xs">Heading</button></div><label className="block text-sm font-semibold text-stone-800">Page Content<textarea rows={16} maxLength={50000} value={pageValue.content} onChange={(event) => updateNested('policyPages', { ...settings.policyPages, [selectedPage]: { ...pageValue, content: event.target.value } })} className="mt-1.5 w-full rounded-xl border border-stone-300 bg-white p-4 font-mono text-sm leading-6 outline-none focus:border-teal-700" /></label><p className="mt-1 text-xs text-stone-500">Simple formatting toolbar inserts Markdown syntax. {pageValue.content.length}/50000 characters.</p></div></div></Section><button type="button" disabled={saving} onClick={() => void saveSettings({ policyPages: settings.policyPages })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123d3a] px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="size-4" />Save Page</button></div>}
        {activeTab === '/admin/settings/pixel' && <div className="space-y-5"><Section title="Facebook Pixel & Conversions API"><div className="grid gap-4 sm:grid-cols-2"><TextField label="Pixel ID" value={settings.pixelSettings.facebookPixelId} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, facebookPixelId: value })} /><SecretField label="Conversion API Access Token" value={settings.pixelSettings.facebookAccessToken} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, facebookAccessToken: value })} /></div></Section><Section title="TikTok Pixel & Events API"><div className="grid gap-4 sm:grid-cols-2"><TextField label="Pixel ID" value={settings.pixelSettings.tiktokPixelId} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, tiktokPixelId: value })} /><SecretField label="Events API Access Token" value={settings.pixelSettings.tiktokAccessToken} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, tiktokAccessToken: value })} /></div></Section><Section title="Google Analytics"><div className="grid gap-4 sm:grid-cols-2"><TextField label="Google Analytics ID" value={settings.pixelSettings.googleAnalyticsId} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, googleAnalyticsId: value })} /><TextField label="Tag Manager ID" value={settings.pixelSettings.googleTagManagerId} onChange={(value) => updateNested('pixelSettings', { ...settings.pixelSettings, googleTagManagerId: value })} /></div></Section><button type="button" disabled={saving} onClick={() => void saveSettings({ pixelSettings: settings.pixelSettings })} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#123d3a] px-5 text-sm font-bold text-white disabled:opacity-60"><Save className="size-4" />Save Pixel Settings</button><p className="text-xs leading-5 text-stone-600">Access tokens are only returned by the authenticated admin settings API and are never included in public storefront settings.</p></div>}
      </motion.div>
    </AnimatePresence>}
    <AnimatePresence>{toast && <motion.div initial={{ opacity: 0, y: 20, x: '-50%' }} animate={{ opacity: 1, y: 0, x: '-50%' }} exit={{ opacity: 0, y: 10, x: '-50%' }} className="fixed bottom-6 left-1/2 z-[120] rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-xl">{toast}</motion.div>}</AnimatePresence>
    <AnimatePresence>{couponModal && <Modal onClose={() => setCouponModal(false)}><div className="mb-5 flex items-start justify-between gap-3"><div><h2 className="text-xl font-black text-stone-900">{editingCoupon ? 'Edit Coupon' : 'Add Coupon'}</h2><p className="mt-1 text-sm text-stone-600">Set discount value and eligibility rules.</p></div><button type="button" onClick={() => setCouponModal(false)} aria-label="Close" className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X className="size-5" /></button></div>{error && <Notice kind="error">{error}</Notice>}<form onSubmit={saveCoupon} className="grid max-h-[75vh] gap-4 overflow-y-auto pr-1 sm:grid-cols-2"><label className="block text-sm font-semibold text-stone-800 sm:col-span-2">Coupon Code<input required minLength={3} maxLength={40} pattern="[A-Za-z0-9_-]+" value={couponForm.code} onChange={(event) => setCouponForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} className={fieldClass} placeholder="SUMMER10" /></label><fieldset className="sm:col-span-2"><legend className="text-sm font-semibold text-stone-800">Discount Type</legend><div className="mt-2 grid grid-cols-2 gap-2">{([['percentage', 'Percentage (%)'], ['amount', 'Amount (৳)']] as const).map(([type, label]) => <button key={type} type="button" onClick={() => setCouponForm((current) => ({ ...current, discountType: type }))} className={`rounded-lg border px-3 py-2.5 text-sm font-bold transition ${couponForm.discountType === type ? 'border-teal-800 bg-teal-50 text-teal-900' : 'border-stone-300 text-stone-700 hover:bg-stone-50'}`}>{label}</button>)}</div></fieldset><label className="block text-sm font-semibold text-stone-800">Discount Value<input required type="number" min="0.01" step="0.01" max={couponForm.discountType === 'percentage' ? 100 : undefined} value={couponForm.discountValue} onChange={(event) => setCouponForm((current) => ({ ...current, discountValue: event.target.value }))} className={fieldClass} /></label><label className="block text-sm font-semibold text-stone-800">Max Discount (optional)<input type="number" min="0" step="0.01" value={couponForm.maxDiscount} onChange={(event) => setCouponForm((current) => ({ ...current, maxDiscount: event.target.value }))} className={fieldClass} /></label><label className="block text-sm font-semibold text-stone-800">Minimum Purchase<input type="number" min="0" step="0.01" value={couponForm.minimumPurchase} onChange={(event) => setCouponForm((current) => ({ ...current, minimumPurchase: event.target.value }))} className={fieldClass} /></label><label className="block text-sm font-semibold text-stone-800">Expiry Date & Time<input type="datetime-local" value={couponForm.expiresAt} onChange={(event) => setCouponForm((current) => ({ ...current, expiresAt: event.target.value }))} className={fieldClass} /></label><div className="sm:col-span-2"><Toggle label="Active coupon" checked={couponForm.isActive} onChange={(checked) => setCouponForm((current) => ({ ...current, isActive: checked }))} /></div><button disabled={couponBusy} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#123d3a] px-5 text-sm font-bold text-white disabled:opacity-60 sm:col-span-2"><Save className="size-4" />{couponBusy ? 'Saving...' : 'Save Coupon'}</button></form></Modal>}</AnimatePresence>
  </main>;
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex min-h-16 items-center justify-between gap-3 rounded-xl border border-stone-200 p-4 text-sm font-semibold text-stone-800">{label}<span className="flex items-center gap-3"><code className="text-xs text-stone-600">{value}</code><input type="color" value={value} onChange={(event) => onChange(event.target.value)} className="size-10 cursor-pointer rounded border border-stone-300 bg-white p-1" /></span></label>;
}

function TextField({ label, value, onChange, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; type?: string }) {
  return <label className="block text-sm font-semibold text-stone-800">{label}<input type={type} value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} /></label>;
}

function SecretField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="block text-sm font-semibold text-stone-800">{label}<input type="password" autoComplete="new-password" value={value} onChange={(event) => onChange(event.target.value)} className={fieldClass} /></label>;
}

function PasswordSettings({ fieldClass: inputClass }: { fieldClass: string }) {
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [status, setStatus] = useState('');
  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setStatus('');
    const response = await fetch('/api/auth/admin/password', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const result = await response.json();
    if (!response.ok || !result.success) return setStatus(result.error || 'Password update failed.');
    setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setStatus('Admin password updated.');
  };
  return <Section title="Admin Password" description="Change your administrator account password."><form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">{(['currentPassword', 'newPassword', 'confirmPassword'] as const).map((field) => <label key={field} className="block text-sm font-semibold text-stone-800">{field === 'currentPassword' ? 'Current password' : field === 'newPassword' ? 'New password' : 'Confirm new password'}<input required minLength={field === 'currentPassword' ? undefined : 8} type="password" autoComplete={field === 'currentPassword' ? 'current-password' : 'new-password'} value={form[field]} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className={inputClass} /></label>)}{status && <p className="text-sm font-medium text-stone-700 sm:col-span-2">{status}</p>}<button className="min-h-10 rounded-lg bg-stone-900 px-4 text-sm font-bold text-white sm:col-span-2">Update password</button></form></Section>;
}
