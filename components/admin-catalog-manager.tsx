'use client';

import { useEffect, useState } from 'react';

type Entry = { _id: string; name: string; description?: string; logoUrl?: string; values?: string[] };

export default function AdminCatalogManager({ resource, title, description }: { resource: 'brands' | 'variants'; title: string; description: string }) {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [name, setName] = useState('');
  const [details, setDetails] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = `/api/admin/catalog/${resource}`;

  const load = async () => {
    const response = await fetch(endpoint);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'তালিকা লোড করা যায়নি।');
    setEntries(result.data);
  };

  useEffect(() => {
    let active = true;
    fetch(endpoint).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'তালিকা লোড করা যায়নি।');
      if (active) setEntries(result.data);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'তালিকা লোড করা যায়নি।'); });
    return () => { active = false; };
  }, [endpoint]);

  const reset = () => { setEditingId(''); setName(''); setDetails(''); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body = resource === 'brands'
        ? { name, description: details }
        : { name, values: details.split(',').map((value) => value.trim()).filter(Boolean) };
      const response = await fetch(editingId ? `${endpoint}?id=${editingId}` : endpoint, {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'তথ্য সেভ করা যায়নি।');
      await load();
      reset();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'তথ্য সেভ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (entry: Entry) => {
    if (!window.confirm(`“${entry.name}” মুছে ফেলবেন?`)) return;
    setError('');
    const response = await fetch(`${endpoint}?id=${entry._id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) return setError(result.error || 'রেকর্ড মুছতে ব্যর্থ হয়েছে।');
    setEntries((current) => current.filter((item) => item._id !== entry._id));
  };

  return <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
    <section className="overflow-x-auto border border-stone-200 bg-white"><div className="border-b border-stone-200 px-4 py-3"><h2 className="font-bold">{title}</h2><p className="mt-1 text-xs text-stone-600">{description}</p></div><table className="w-full text-left text-sm"><thead className="bg-stone-50 text-xs font-bold text-stone-700"><tr><th className="px-4 py-3">নাম</th><th className="px-4 py-3">{resource === 'brands' ? 'বিবরণ' : 'অ্যাট্রিবিউট ভ্যালু'}</th><th className="px-4 py-3">অ্যাকশন</th></tr></thead><tbody className="divide-y divide-stone-100">{entries.map((entry) => <tr key={entry._id} className="hover:bg-stone-50"><td className="px-4 py-3 font-semibold">{entry.name}</td><td className="px-4 py-3 text-stone-700">{resource === 'brands' ? entry.description || '—' : (entry.values || []).join(', ')}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => { setEditingId(entry._id); setName(entry.name); setDetails(resource === 'brands' ? entry.description || '' : (entry.values || []).join(', ')); }} className="border border-stone-300 px-3 py-2 text-xs font-bold hover:border-[#dc2626]">সম্পাদনা</button><button type="button" onClick={() => remove(entry)} className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">মুছুন</button></div></td></tr>)}{entries.length === 0 && <tr><td colSpan={3} className="px-4 py-8 text-center text-sm text-stone-600">এখনো কোনো রেকর্ড নেই।</td></tr>}</tbody></table></section>
    <form onSubmit={save} className="space-y-4 border border-stone-200 bg-white p-5"><h2 className="font-bold">{editingId ? 'সম্পাদনা' : 'নতুন যোগ করুন'}</h2>{error && <p role="alert" className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<label className="block text-sm font-semibold">{resource === 'brands' ? 'ব্র্যান্ডের নাম' : 'অ্যাট্রিবিউটের নাম'}<input required maxLength={120} value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 text-sm font-normal outline-none focus:border-[#dc2626]" /></label><label className="block text-sm font-semibold">{resource === 'brands' ? 'বিবরণ' : 'ভ্যালু (কমা দিয়ে আলাদা করুন)'}{resource === 'brands' ? <textarea rows={3} value={details} onChange={(event) => setDetails(event.target.value)} className="mt-1.5 w-full border border-stone-300 p-3 text-sm font-normal outline-none focus:border-[#dc2626]" /> : <input required value={details} onChange={(event) => setDetails(event.target.value)} placeholder="S, M, L" className="mt-1.5 h-11 w-full border border-stone-300 px-3 text-sm font-normal outline-none focus:border-[#dc2626]" />}</label><div className="flex gap-2"><button disabled={busy} className="min-h-10 flex-1 bg-[#dc2626] px-4 text-sm font-bold text-white disabled:opacity-60">{busy ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>{editingId && <button type="button" onClick={reset} className="border border-stone-300 px-4 text-sm font-bold">বাতিল</button>}</div></form>
  </div>;
}
