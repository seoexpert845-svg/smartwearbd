'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';

export default function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/auth/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password, remember }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অ্যাডমিন সাইন ইন করা যায়নি।');
      router.replace('/admin');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'অ্যাডমিন সাইন ইন করা যায়নি।');
    } finally {
      setLoading(false);
    }
  };

  return <main className="admin-login-page grid min-h-screen place-items-center px-4 py-10 sm:px-7"><section className="admin-login-card w-full max-w-[560px] rounded-[22px] bg-white px-6 py-10 shadow-xl sm:px-14 sm:py-14">
    <div className="text-center"><span className="admin-login-mark mx-auto grid size-20 place-items-center rounded-[26px]"><LockKeyhole className="size-9 text-[#d2b47b]" strokeWidth={1.7} /></span><h1 className="mt-7 font-serif text-4xl tracking-wide text-[#132e20] sm:text-5xl">SmartWearBD</h1><p className="mt-4 text-sm leading-7 text-stone-500 sm:text-base">অ্যাডমিন ম্যানেজমেন্ট প্যানেলে প্রবেশ করুন</p></div>
    <form onSubmit={submit} className="mt-10 space-y-6"><label className="account-label">অ্যাডমিন ইমেইল<span className="account-password-wrap"><Mail className="size-5 shrink-0 text-stone-500" /><input required type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="admin@example.com" className="min-w-0 flex-1 bg-transparent outline-none" /></span></label><label className="account-label">পাসওয়ার্ড<span className="account-password-wrap"><LockKeyhole className="size-5 shrink-0 text-stone-500" /><input required type={visible ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="আপনার admin password" className="min-w-0 flex-1 bg-transparent outline-none" /><button type="button" onClick={() => setVisible((current) => !current)} aria-label={visible ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}>{visible ? <EyeOff className="size-5" /> : <Eye className="size-5" />}</button></span></label><label className="inline-flex items-center gap-2 text-sm text-stone-600"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} className="size-4 accent-[#1b3b2b]" />৩০ দিন login মনে রাখুন</label>{error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}<button type="submit" disabled={loading} className="account-submit justify-center">{loading ? 'যাচাই করা হচ্ছে…' : 'অ্যাডমিন প্যানেলে প্রবেশ করুন'}</button></form>
    <p className="mt-8 text-center text-sm leading-7 text-stone-500">এই login শুধু configured admin account-এর জন্য। Customer account দিয়ে এই panel খোলা যাবে না।</p>
  </section></main>;
}
