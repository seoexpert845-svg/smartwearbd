'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowRight, Eye, EyeOff, Grid2X2, Heart, House, LockKeyhole, PackageCheck, ShoppingBag, UserRound } from 'lucide-react';
import { findBangladeshDistrict, getBangladeshUpazilas } from '@/lib/bangladesh-locations';
import SearchableDistrictSelect from '@/components/searchable-district-select';

type Profile = { name: string; phone: string; district?: string; thana?: string; role?: string };

export default function AccountAuth() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signup');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [district, setDistrict] = useState('');
  const [thana, setThana] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState('');
  const [helpOpen, setHelpOpen] = useState(false);
  const upazilas = getBangladeshUpazilas(district);
  const selectedDistrict = findBangladeshDistrict(district);

  useEffect(() => {
    fetch('/api/auth/session').then((response) => response.json()).then((result) => {
      if (result.success && result.data?.role === 'user') setProfile(result.data);
    }).catch(() => undefined);
  }, []);

  const notify = (message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!/^01[3-9]\d{8}$/.test(phone)) return notify('সঠিক ১১ সংখ্যার বাংলাদেশি ফোন নম্বর দিন।');
    if (password.length < 8) return notify('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
    if (mode === 'signup' && (!name.trim() || !district || !thana)) return notify('সব প্রয়োজনীয় তথ্য পূরণ করুন।');
    setLoading(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, phone, district, thana, password, remember }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অনুরোধটি সম্পন্ন করা যায়নি।');
      setProfile(result.data);
      notify(mode === 'signup' ? 'আপনার অ্যাকাউন্ট তৈরি হয়েছে।' : 'সাইন ইন সফল হয়েছে।');
    } catch (error) {
      notify(error instanceof Error ? error.message : 'সাইন ইন করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setProfile(null);
    setPassword('');
    notify('আপনি সাইন আউট করেছেন।');
  };

  return <main className="account-page min-h-screen pb-28 text-[#17251f] sm:pb-8">
    <header className="account-header px-5 pb-8 pt-8 text-white sm:px-10 sm:pb-10">
      <div className="mx-auto max-w-5xl"><Link href="/" className="account-brand">SmartWearBD</Link><p className="mt-6 max-w-xl text-sm leading-7 text-white/75 sm:text-base">আপনার order, wishlist ও profile এক জায়গায় রাখুন।</p></div>
    </header>
    <section className="account-card mx-auto -mt-2 max-w-2xl overflow-hidden rounded-t-[24px] bg-white shadow-xl sm:mt-8 sm:rounded-[24px]">
      <div className="account-card-hero px-6 py-8 text-white sm:px-10 sm:py-9"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#d3be91]">কাস্টমার অ্যাকাউন্ট</p><h1 className="mt-4 text-3xl font-semibold leading-tight sm:text-4xl">{profile ? `স্বাগতম, ${profile.name}` : 'নতুন অ্যাকাউন্ট তৈরি করুন'}</h1><p className="mt-4 max-w-lg text-sm leading-7 text-white/75">আপনার order, wishlist ও profile এক জায়গায় রাখুন।</p></div>
      <div className="px-5 py-8 sm:px-10 sm:py-10">
        {profile ? <div className="py-5"><div className="flex items-center gap-4"><span className="grid size-14 place-items-center rounded-full bg-[#e9eee9] text-[#1b3b2b]"><UserRound className="size-6" /></span><div><h2 className="text-xl font-semibold">{profile.name}</h2><p className="mt-1 text-sm text-stone-500">{profile.phone}</p><p className="mt-1 text-xs text-stone-500">{profile.district || ''}{profile.thana ? ` · ${profile.thana}` : ''}</p></div></div><div className="mt-8 grid gap-3 sm:grid-cols-2"><Link href="/#products" className="account-secondary-action"><ShoppingBag className="size-4" /> কেনাকাটা চালিয়ে যান</Link><button type="button" onClick={signOut} className="account-secondary-action">সাইন আউট</button></div></div> : <>
          <div className="account-tabs" role="tablist" aria-label="অ্যাকাউন্ট অ্যাক্সেস"><button type="button" role="tab" aria-selected={mode === 'signin'} onClick={() => setMode('signin')}>সাইন ইন</button><button type="button" role="tab" aria-selected={mode === 'signup'} onClick={() => setMode('signup')}>সাইন আপ</button></div>
          <form onSubmit={submit} className="mt-8 space-y-5">
            {mode === 'signup' && <label className="account-label">আপনার নাম<input required autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} placeholder="পুরো নাম" className="account-input" /></label>}
            <label className="account-label">ফোন নম্বর<input required type="tel" autoComplete="tel" inputMode="numeric" pattern="01[3-9][0-9]{8}" maxLength={11} value={phone} onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} placeholder="01XXXXXXXXX" className="account-input" /></label>
            {mode === 'signup' && <>
              <label className="account-label">জেলা<SearchableDistrictSelect required value={selectedDistrict?.english || ''} onChange={(value) => { setDistrict(value); setThana(''); }} className="account-input" /></label>
              <label className="account-label">থানা<select required disabled={!district} value={upazilas.find((item) => item.english === thana || item.bangla === thana)?.english || ''} onChange={(event) => setThana(event.target.value)} className="account-input disabled:opacity-50"><option value="" disabled>{district ? 'থানা বেছে নিন' : 'আগে জেলা বেছে নিন'}</option>{upazilas.map((item) => <option key={item.id} value={item.english}>{item.bangla} ({item.english})</option>)}</select></label>
            </>}
            <label className="account-label">পাসওয়ার্ড<span className="account-password-wrap"><LockKeyhole className="size-5 shrink-0 text-stone-500" /><input required type={showPassword ? 'text' : 'password'} minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="কমপক্ষে ৮ অক্ষর" className="min-w-0 flex-1 bg-transparent outline-none" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}>{showPassword ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label>
            {mode === 'signin' && <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-stone-600"><label className="inline-flex items-center gap-2"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-[#1b3b2b]" />আমাকে মনে রাখুন</label><a href="#password-help" onClick={(event) => { event.preventDefault(); setHelpOpen((open) => !open); }} aria-expanded={helpOpen} className="font-semibold text-[#1b3b2b] underline underline-offset-4">Password ভুলে গেছেন?</a></div>}
            {helpOpen && <p className="rounded-lg bg-[#f7f5ef] px-4 py-3 text-sm leading-6 text-stone-600">পাসওয়ার্ড রিসেটের জন্য আপনার ফোন নম্বরসহ স্টোর সাপোর্টে যোগাযোগ করুন।</p>}
            <button type="submit" disabled={loading} className="account-submit">{loading ? 'অপেক্ষা করুন…' : mode === 'signup' ? 'সাইন আপ সম্পন্ন করুন' : 'সাইন ইন করুন'} <ArrowRight className="size-5" /></button>
          </form>
          <p className="mt-7 text-center text-sm text-stone-500">{mode === 'signup' ? 'আগে account আছে? ' : 'নতুন customer? '}<button type="button" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')} className="font-semibold text-[#1b3b2b] underline underline-offset-4">{mode === 'signup' ? 'সাইন ইন নির্বাচন করুন' : 'সাইন আপ করুন'}</button></p>
        </>}
      </div>
    </section>
    {toast && <div role="status" className="fixed right-4 top-5 z-50 max-w-[calc(100vw-2rem)] rounded-lg bg-[#132e20] px-4 py-3 text-sm font-semibold text-white shadow-lg">{toast}</div>}
    <nav aria-label="মোবাইল নেভিগেশন" className="account-bottom-nav fixed inset-x-0 bottom-0 z-40 grid grid-cols-6 px-2 pb-[env(safe-area-inset-bottom)] sm:hidden">
      <Link href="/" className="account-nav-item"><House /><span>হোম</span></Link><Link href="/#categories" className="account-nav-item"><Grid2X2 /><span>ক্যাটাগরি</span></Link><Link href="/" className="account-nav-item"><ShoppingBag /><span>কার্ট</span></Link><Link href="/" className="account-nav-item"><Heart /><span>উইশলিস্ট</span></Link><Link href="/" className="account-nav-item"><PackageCheck /><span>অর্ডার</span></Link><Link href="/account" aria-current="page" className="account-nav-item is-active"><UserRound /><span>অ্যাকাউন্ট</span></Link>
    </nav>
  </main>;
}
