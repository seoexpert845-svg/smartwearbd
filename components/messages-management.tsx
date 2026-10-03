'use client';

import { useCallback, useEffect, useState } from 'react';
import { Mail, MessageCircle, Phone, Trash2 } from 'lucide-react';

type CustomerMessage = { _id: string; name: string; phone: string; email: string; message: string; createdAt: string };

export default function MessagesManagement() {
  const [messages, setMessages] = useState<CustomerMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tools/messages', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'ইনবক্স লোড করা যায়নি।');
      setError('');
      setMessages(result.data);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ইনবক্স লোড করা যায়নি।'); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const remove = async (message: CustomerMessage) => {
    if (!window.confirm(`${message.name}-এর বার্তাটি মুছবেন?`)) return;
    setBusyId(message._id); setError('');
    try {
      const response = await fetch(`/api/admin/tools/messages/${message._id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'বার্তা মুছতে পারেনি।');
      setMessages((current) => current.filter((item) => item._id !== message._id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'বার্তা মুছতে পারেনি।'); }
    finally { setBusyId(''); }
  };

  return <main className="max-w-7xl">
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Customer care</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Messages inbox</h1><p className="mt-1 text-sm text-stone-600">Website customer queries, newest first.</p></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <section className="overflow-hidden rounded-xl border border-stone-200 bg-white"><div className="flex items-center gap-2 border-b border-stone-200 p-4"><MessageCircle className="size-4 text-teal-800" /><strong>{messages.length} messages</strong></div>    <div className="overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-stone-50 text-[11px] font-bold uppercase text-stone-500"><tr>{['SL', 'Name', 'Phone / contact', 'Message', 'Created', 'Actions'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{messages.map((message, index) => <tr key={message._id} className="align-top hover:bg-stone-50"><td className="px-4 py-4 text-stone-500">{index + 1}</td><td className="px-4 py-4 font-bold">{message.name}</td><td className="px-4 py-4"><a href={`tel:${message.phone}`} className="inline-flex items-center gap-1 font-semibold text-teal-800"><Phone className="size-3.5" />{message.phone}</a>{message.email && <a href={`mailto:${message.email}`} className="mt-1 flex items-center gap-1 text-xs text-stone-500"><Mail className="size-3" />{message.email}</a>}</td><td className="max-w-lg whitespace-pre-wrap px-4 py-4 text-stone-700">{message.message}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-stone-500">{new Date(message.createdAt).toLocaleString()}</td><td className="px-4 py-4"><div className="flex gap-2">{message.email ? <a aria-label="Reply by email" title="Reply by email" href={`mailto:${message.email}?subject=${encodeURIComponent('Re: Your message to our store')}`} className="grid size-9 place-items-center rounded-lg border border-stone-200 hover:bg-stone-100"><Mail className="size-4" /></a> : <a aria-label="Reply by WhatsApp" title="Reply by WhatsApp" target="_blank" rel="noreferrer" href={`https://wa.me/${message.phone.replace(/\D/g, '').replace(/^0/, '88')}`} className="grid size-9 place-items-center rounded-lg border border-stone-200 hover:bg-stone-100"><MessageCircle className="size-4" /></a>}<button type="button" disabled={busyId === message._id} aria-label="Delete message" onClick={() => void remove(message)} className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div>{!loading && !messages.length && <p className="p-10 text-center text-sm text-stone-500">এখনো কোনো বার্তা নেই।</p>}{loading && <p className="p-10 text-center text-sm text-stone-500">বার্তা লোড হচ্ছে...</p>}</section>
  </main>;
}
