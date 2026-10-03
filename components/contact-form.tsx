'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';

const inputClass = 'mt-1.5 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-700';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', phone: '', email: '', message: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/messages', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'বার্তা পাঠানো যায়নি।');
      setSent(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'বার্তা পাঠানো যায়নি।');
    } finally { setBusy(false); }
  };

  return <section className="mt-7 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
    {sent ? <div role="status" className="py-8 text-center"><span className="text-3xl text-emerald-700">✓</span><h2 className="mt-3 text-xl font-black">বার্তা পাঠানো হয়েছে</h2><p className="mt-2 text-sm text-stone-600">যোগাযোগ করার জন্য ধন্যবাদ।</p><Link href="/" className="mt-5 inline-flex min-h-10 items-center rounded-lg bg-teal-800 px-4 text-sm font-bold text-white">স্টোরে ফিরুন</Link></div> : <form onSubmit={submit} className="space-y-4">
      {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
      <label className="block text-sm font-semibold">আপনার নাম *<input required maxLength={120} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} className={inputClass} /></label>
      <label className="block text-sm font-semibold">ফোন নম্বর *<input required maxLength={32} value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} className={inputClass} /></label>
      <label className="block text-sm font-semibold">ইমেইল (ঐচ্ছিক)<input type="email" maxLength={254} value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} className={inputClass} /></label>
      <label className="block text-sm font-semibold">বার্তা *<textarea required minLength={4} maxLength={5000} rows={6} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} className="mt-1.5 w-full rounded-lg border border-stone-300 p-3 text-sm outline-none focus:border-teal-700" /></label>
      <button disabled={busy} className="min-h-11 w-full rounded-lg bg-teal-800 px-5 text-sm font-bold text-white disabled:opacity-50">{busy ? 'পাঠানো হচ্ছে...' : 'বার্তা পাঠান'}</button>
    </form>}
  </section>;
}
