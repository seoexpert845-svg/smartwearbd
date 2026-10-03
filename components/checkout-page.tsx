'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, PackageCheck, Trash2 } from 'lucide-react';
import { findBangladeshDistrict, getBangladeshUpazilas, isKhulnaDistrict } from '@/lib/bangladesh-locations';
import { getSalePrice } from '@/lib/product-pricing';
import { normalizeImageUrl } from '@/lib/image-url';
import SearchableDistrictSelect from '@/components/searchable-district-select';

type Product = { _id: string; name: string; price: number; salePrice?: number; regularPrice?: number; imageUrl?: string; images?: string[]; stock?: number; maxOrderQuantity?: number; freeShipping?: boolean };
type CartLine = { product: Product; quantity: number; selectedImage?: string; variant?: string };
type DeliveryProfile = { customerName: string; customerPhone: string; district: string; thana: string; customerAddress: string };

const money = (amount: number) => `৳${new Intl.NumberFormat('bn-BD').format(amount)}`;

export default function CheckoutPage() {
  const [items, setItems] = useState<CartLine[]>([]);
  const [profile, setProfile] = useState<DeliveryProfile>({ customerName: '', customerPhone: '', district: '', thana: '', customerAddress: '' });
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [cartSessionId, setCartSessionId] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [couponBusy, setCouponBusy] = useState(false);
  const district = findBangladeshDistrict(profile.district);
  const upazilas = getBangladeshUpazilas(profile.district);
  const subtotal = items.reduce((sum, line) => sum + getSalePrice(line.product) * line.quantity, 0);
  const shippingFee = items.length && items.every((line) => line.product.freeShipping) ? 0 : profile.district ? (isKhulnaDistrict(profile.district) ? 80 : 150) : 0;
  const total = Math.max(0, subtotal + shippingFee - couponDiscount);

  const applyCoupon = async () => {
    if (!couponCode.trim()) return setCouponMessage('কুপন কোড লিখুন।');
    setCouponBusy(true);
    setCouponMessage('');
    try {
      const response = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'কুপন যাচাই করা যায়নি।');
      setCouponCode(result.data.code);
      setCouponDiscount(result.data.discount);
      setCouponMessage('কুপন প্রয়োগ হয়েছে।');
    } catch (reason) {
      setCouponDiscount(0);
      setCouponMessage(reason instanceof Error ? reason.message : 'কুপন যাচাই করা যায়নি।');
    } finally {
      setCouponBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      try {
        const selected = localStorage.getItem('smartwearbd-checkout');
        const storedCart = localStorage.getItem('smartwearbd-cart');
        let sessionId = localStorage.getItem('smartwearbd-cart-session');
        if (!sessionId) {
          sessionId = crypto.randomUUID();
          localStorage.setItem('smartwearbd-cart-session', sessionId);
        }
        setCartSessionId(sessionId);
        const parsedSelected = selected ? JSON.parse(selected) : null;
        const parsedCart = storedCart ? JSON.parse(storedCart) : [];
        setItems(Array.isArray(parsedSelected) && parsedSelected.length ? parsedSelected : Array.isArray(parsedCart) ? parsedCart : []);
        const savedProfile = localStorage.getItem('ghorbazar-profile');
        if (savedProfile) {
          const parsed = JSON.parse(savedProfile);
          setProfile({ customerName: parsed.customerName || '', customerPhone: parsed.customerPhone || '', district: parsed.district || '', thana: parsed.thana || '', customerAddress: parsed.customerAddress || '' });
        }
      } catch {
        setError('কার্টের তথ্য পড়া যায়নি। আবার পণ্য যোগ করুন।');
      } finally {
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (loading || !cartSessionId || !items.length) return;
    const timer = window.setTimeout(() => {
      void fetch('/api/abandoned-carts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: cartSessionId, stage: 'checkout', customerName: profile.customerName, customerPhone: profile.customerPhone, userEmail: email, district: profile.district, thana: profile.thana, customerAddress: profile.customerAddress, items: items.map(({ product, quantity, variant }) => ({ productId: product._id, name: product.name, price: getSalePrice(product), quantity, variant, imageUrl: product.images?.[0] || product.imageUrl || '' })) }),
      }).catch(() => undefined);
    }, 850);
    return () => window.clearTimeout(timer);
  }, [loading, cartSessionId, items, profile, email]);

  const removeItem = (productId: string, variant?: string) => {
    setCouponDiscount(0);
    setCouponMessage('');
    setItems((current) => current.filter((line) => !(line.product._id === productId && line.variant === variant)));
    const storedCart = JSON.parse(localStorage.getItem('smartwearbd-cart') || '[]') as CartLine[];
    localStorage.setItem('smartwearbd-cart', JSON.stringify(storedCart.filter((line) => !(line.product._id === productId && line.variant === variant))));
    const selected = JSON.parse(localStorage.getItem('smartwearbd-checkout') || 'null') as CartLine[] | null;
    if (selected) {
      const remaining = selected.filter((line) => !(line.product._id === productId && line.variant === variant));
      if (remaining.length) localStorage.setItem('smartwearbd-checkout', JSON.stringify(remaining));
      else localStorage.removeItem('smartwearbd-checkout');
    }
  };

  const changeQuantity = (productId: string, delta: number, variant?: string) => {
    const currentLine = items.find((line) => line.product._id === productId && line.variant === variant);
    if (!currentLine) return;
    if (Number(currentLine.quantity || 1) + delta < 1) return removeItem(productId, variant);
    const limit = Math.min(currentLine.product.stock ?? Number.MAX_SAFE_INTEGER, currentLine.product.maxOrderQuantity || Number.MAX_SAFE_INTEGER);
    if (Number(currentLine.quantity || 1) + delta > limit) return setError('এই পণ্যের উপলভ্য স্টক বা সর্বোচ্চ অর্ডার পরিমাণ অতিক্রম হয়েছে।');
    setCouponDiscount(0);
    setCouponMessage('');
    const nextItems = items.map((line) => line.product._id === productId && line.variant === variant ? { ...line, quantity: Number(line.quantity || 1) + delta } : line);
    setItems(nextItems);
    const storedCart = JSON.parse(localStorage.getItem('smartwearbd-cart') || '[]') as CartLine[];
    localStorage.setItem('smartwearbd-cart', JSON.stringify(storedCart.map((line) => line.product._id === productId && line.variant === variant ? { ...line, quantity: Number(line.quantity || 1) + delta } : line)));
    const selected = JSON.parse(localStorage.getItem('smartwearbd-checkout') || 'null') as CartLine[] | null;
    if (selected) localStorage.setItem('smartwearbd-checkout', JSON.stringify(selected.map((line) => line.product._id === productId && line.variant === variant ? { ...line, quantity: Number(line.quantity || 1) + delta } : line)));
  };

  const chooseImage = (productId: string, imageUrl: string) => {
    const nextItems = items.map((line) => line.product._id === productId ? { ...line, selectedImage: imageUrl } : line);
    setItems(nextItems);
    const updateStored = (key: string) => {
      const stored = JSON.parse(localStorage.getItem(key) || 'null') as CartLine[] | null;
      if (stored) localStorage.setItem(key, JSON.stringify(stored.map((line) => line.product._id === productId ? { ...line, selectedImage: imageUrl } : line)));
    };
    updateStored('smartwearbd-cart');
    updateStored('smartwearbd-checkout');
  };

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (!items.length) return setError('আপনার কার্টে কোনো পণ্য নেই।');
    if (!/^01[3-9]\d{8}$/.test(profile.customerPhone)) return setError('সঠিক ১১ সংখ্যার বাংলাদেশি ফোন নম্বর দিন।');
    setSubmitting(true);
    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: profile.customerName,
          customerPhone: profile.customerPhone,
          district: district?.english || profile.district,
          thana: profile.thana,
          customerAddress: `জেলা: ${district?.english || profile.district}, থানা: ${profile.thana}, ঠিকানা: ${profile.customerAddress}`,
          shippingAddress: `জেলা: ${district?.english || profile.district}, থানা: ${profile.thana}, ঠিকানা: ${profile.customerAddress}`,
          userEmail: email.trim() || 'guest@example.com',
          cartSessionId,
          couponCode,
          items: items.map(({ product, quantity, selectedImage, variant }) => ({ productId: product._id, name: product.name, price: getSalePrice(product), quantity, variant, imageUrl: selectedImage || product.images?.[0] || product.imageUrl || '' })),
          shippingFee,
          totalAmount: subtotal + shippingFee,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অর্ডার জমা দেওয়া যায়নি।');

      localStorage.setItem('ghorbazar-profile', JSON.stringify(profile));
      localStorage.removeItem('smartwearbd-checkout');
      const ordered = new Map(items.map((line) => [`${line.product._id}:${line.variant || ''}`, line.quantity]));
      const storedCart = JSON.parse(localStorage.getItem('smartwearbd-cart') || '[]') as CartLine[];
      localStorage.setItem('smartwearbd-cart', JSON.stringify(storedCart.map((line) => ({ ...line, quantity: line.quantity - (ordered.get(`${line.product._id}:${line.variant || ''}`) || 0) })).filter((line) => line.quantity > 0)));
      setSuccess(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'অর্ডার জমা দেওয়া যায়নি।');
    } finally {
      setSubmitting(false);
    }
  };

  return <main className="min-h-screen bg-[#f7f5ef] px-4 py-6 text-[#17251f] sm:px-8 sm:py-10"><div className="mx-auto max-w-5xl">
    <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#1b3b2b] hover:underline"><ArrowLeft className="size-4" />কেনাকাটায় ফিরুন</Link>
    <header className="mt-6 flex items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#64766d]">SmartWearBD</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">চেকআউট</h1></div><PackageCheck className="size-7 text-[#1b3b2b]" /></header>
    {success ? <section className="mt-7 rounded-xl border border-emerald-200 bg-white p-8 text-center shadow-sm"><CheckCircle2 className="mx-auto size-12 text-emerald-700" /><h2 className="mt-4 text-xl font-bold">অর্ডার সফলভাবে জমা হয়েছে</h2><p className="mt-2 text-sm text-stone-600">আমরা শিগগিরই আপনার সঙ্গে যোগাযোগ করব।</p><Link href="/" className="mt-6 inline-flex min-h-11 items-center justify-center rounded-lg bg-[#1b3b2b] px-5 text-sm font-bold text-white">কেনাকাটা চালিয়ে যান</Link></section> : loading ? <p className="mt-8 rounded-lg bg-white p-8 text-center text-sm text-stone-500">চেকআউট লোড হচ্ছে...</p> : <form onSubmit={submitOrder} className="mt-7 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
      <section className="rounded-xl border border-stone-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">ডেলিভারির তথ্য</h2><div className="mt-5 space-y-4">
        <label className="block text-sm font-semibold">আপনার নাম<input required autoComplete="name" value={profile.customerName} onChange={(event) => setProfile((current) => ({ ...current, customerName: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-[#1b3b2b]" /></label>
        <label className="block text-sm font-semibold">ফোন নম্বর<input required type="tel" inputMode="numeric" pattern="01[3-9][0-9]{8}" maxLength={11} autoComplete="tel" value={profile.customerPhone} onChange={(event) => setProfile((current) => ({ ...current, customerPhone: event.target.value.replace(/\D/g, '').slice(0, 11) }))} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-[#1b3b2b]" placeholder="01XXXXXXXXX" /></label>
        <label className="block text-sm font-semibold">ইমেইল (ঐচ্ছিক)<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-[#1b3b2b]" /></label>
        <div className="grid gap-4 sm:grid-cols-2"><label className="block text-sm font-semibold">জেলা<SearchableDistrictSelect required value={district?.english || ''} onChange={(value) => setProfile((current) => ({ ...current, district: value, thana: '' }))} className="mt-1.5 rounded-lg" /></label><label className="block text-sm font-semibold">থানা<select required disabled={!district} value={upazilas.find((item) => item.english === profile.thana || item.bangla === profile.thana)?.english || ''} onChange={(event) => setProfile((current) => ({ ...current, thana: event.target.value }))} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 font-normal outline-none focus:border-[#1b3b2b] disabled:opacity-50"><option value="" disabled>থানা বেছে নিন</option>{upazilas.map((item) => <option key={item.id} value={item.english}>{item.bangla}</option>)}</select></label></div>
        <label className="block text-sm font-semibold">সম্পূর্ণ ঠিকানা<textarea required rows={3} value={profile.customerAddress} onChange={(event) => setProfile((current) => ({ ...current, customerAddress: event.target.value }))} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 font-normal outline-none focus:border-[#1b3b2b]" placeholder="বাসা, রোড, এলাকা" /></label>
      </div></section>
      <section className="h-fit rounded-xl border border-stone-200 bg-white p-5 sm:p-7"><h2 className="text-lg font-bold">আপনার অর্ডার</h2>{items.length ? <ul className="mt-4 divide-y divide-stone-200">{items.map((line) => { const { product, quantity } = line; const imageUrls = (product.images?.length ? product.images : [product.imageUrl || '']).map((image) => normalizeImageUrl(image)).filter(Boolean); const activeImage = normalizeImageUrl(line.selectedImage || imageUrls[0] || ''); return <li key={product._id} className="flex flex-wrap items-center gap-3 py-3"><div className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-md bg-stone-100 text-stone-400">{activeImage ? <img src={activeImage} alt={product.name} className="size-full object-cover" /> : '◇'}</div><span className="min-w-0 flex-1"><strong className="block truncate text-sm">{product.name}</strong><small className="mt-1 block text-stone-500">{money(getSalePrice(product))} /টি</small><span className="mt-2 inline-flex h-8 items-center rounded-md border border-stone-200"><button type="button" onClick={() => changeQuantity(product._id, -1)} aria-label={`${product.name} পরিমাণ কমান`} className="grid size-8 place-items-center rounded-l-md text-lg hover:bg-stone-100">−</button><span className="min-w-8 text-center text-xs font-bold">{quantity}</span><button type="button" onClick={() => changeQuantity(product._id, 1)} aria-label={`${product.name} পরিমাণ বাড়ান`} className="grid size-8 place-items-center rounded-r-md text-lg hover:bg-stone-100">+</button></span></span><div className="flex items-center gap-2"><strong className="text-sm">{money(quantity * getSalePrice(product))}</strong><button type="button" onClick={() => removeItem(product._id)} aria-label={`${product.name} কার্ট থেকে সরান`} title="পণ্য সরান" className="grid size-9 shrink-0 place-items-center text-red-700 transition hover:scale-105 hover:bg-red-50 active:scale-95"><Trash2 className="size-4" /></button></div>{imageUrls.length > 1 && <span className="flex w-full gap-1.5 pl-17">{imageUrls.slice(0, 5).map((image, index) => <button key={`${image}-${index}`} type="button" onClick={() => chooseImage(product._id, image)} aria-label={`${product.name} ছবি ${index + 1} নির্বাচন`} aria-pressed={activeImage === image} className={`size-10 overflow-hidden rounded border-2 transition hover:scale-105 ${activeImage === image ? 'border-[#16805f]' : 'border-stone-200'}`}><img src={image} alt="" className="size-full object-cover" /></button>)}</span>}</li>; })}</ul> : <p className="mt-4 rounded-lg bg-stone-50 p-4 text-sm text-stone-600">কার্টে পণ্য নেই। <Link href="/" className="font-bold text-[#1b3b2b] underline">পণ্য দেখুন</Link></p>}
        <div className="mt-4 flex gap-2"><input aria-label="কুপন কোড" value={couponCode} onChange={(event) => { setCouponCode(event.target.value.toUpperCase()); setCouponDiscount(0); setCouponMessage(''); }} placeholder="কুপন কোড" className="h-10 min-w-0 flex-1 rounded-lg border border-stone-300 px-3 text-sm uppercase outline-none focus:border-[#1b3b2b]" /><button type="button" disabled={couponBusy} onClick={() => void applyCoupon()} className="rounded-lg bg-[#1b3b2b] px-4 text-sm font-bold text-white disabled:opacity-60">{couponBusy ? 'যাচাই...' : 'প্রয়োগ'}</button></div>{couponMessage && <p role="status" className="mt-2 text-xs font-medium text-stone-600">{couponMessage}</p>}
        <div className="mt-4 space-y-3 border-t border-stone-200 pt-4 text-sm"><div className="flex justify-between"><span className="text-stone-600">সাবটোটাল</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span className="text-stone-600">ডেলিভারি</span><strong>{profile.district ? money(shippingFee) : 'জেলা নির্বাচন করুন'}</strong></div>{couponDiscount > 0 && <div className="flex justify-between text-emerald-700"><span>কুপন ছাড়</span><strong>−{money(couponDiscount)}</strong></div>}<div className="flex justify-between border-t border-stone-200 pt-3 text-base font-black"><span>সর্বমোট</span><span>{money(total)}</span></div></div>
        {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<button type="submit" disabled={submitting || !items.length} className="mt-5 min-h-12 w-full rounded-lg bg-[#1b3b2b] px-4 text-sm font-bold text-white transition hover:bg-[#132e20] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'অর্ডার জমা হচ্ছে…' : 'অর্ডার নিশ্চিত করুন'}</button>
      </section>
    </form>}
  </div></main>;
}
