'use client';

import { useEffect, useState } from 'react';

type Section = { _id: string; name: string; slug: string; description: string; sortOrder: number; isActive: boolean };

export default function ProductSectionsPage() {
  const [sections, setSections] = useState<Section[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [editingId, setEditingId] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const endpoint = '/api/admin/catalog/sections';
  const load = async () => {
    const response = await fetch(endpoint);
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'সেকশন লোড করা যায়নি।');
    setSections((result.data as Section[]).sort((a, b) => a.sortOrder - b.sortOrder));
  };
  useEffect(() => {
    let active = true;
    fetch(endpoint).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'সেকশন লোড করা যায়নি।');
      if (active) setSections((result.data as Section[]).sort((a, b) => a.sortOrder - b.sortOrder));
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'সেকশন লোড করা যায়নি।'); });
    return () => { active = false; };
  }, []);

  const save = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await fetch(editingId ? `${endpoint}?id=${editingId}` : endpoint, { method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, description }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'সেকশন সেভ করা যায়নি।');
      setName(''); setDescription(''); setEditingId('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'সেকশন সেভ করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const reorder = async (index: number, delta: -1 | 1) => {
    const next = [...sections];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    setSections(next);
    const response = await fetch(`${endpoint}/reorder`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: next.map((section) => section._id) }) });
    const result = await response.json();
    if (!response.ok || !result.success) {
      setSections(sections);
      setError(result.error || 'ক্রম সংরক্ষণ করা যায়নি।');
    }
  };

  const remove = async (section: Section) => {
    if (!window.confirm(`“${section.name}” সেকশন মুছে ফেলবেন?`)) return;
    const response = await fetch(`${endpoint}?id=${section._id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) return setError(result.error || 'সেকশন মুছতে ব্যর্থ হয়েছে।');
    setSections((current) => current.filter((item) => item._id !== section._id));
  };

  return <div><header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black">হোমপেজ সেকশন</h1><p className="mt-1 text-sm text-stone-600">Flash Sale, Best Sells, Top Rated, Hot Deals—নাম, দৃশ্যমানতা ও প্রদর্শনের ক্রম পরিচালনা করুন।</p></header>{error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]"><section className="space-y-2">{sections.map((section, index) => <article key={section._id} className="flex flex-wrap items-center gap-3 border border-stone-200 bg-white p-4"><div className="flex flex-col"><button type="button" onClick={() => reorder(index, -1)} disabled={index === 0} aria-label={`${section.name} дээш`} className="px-2 text-stone-600 hover:text-black disabled:opacity-30">▲</button><button type="button" onClick={() => reorder(index, 1)} disabled={index === sections.length - 1} aria-label={`${section.name} নিচে`} className="px-2 text-stone-600 hover:text-black disabled:opacity-30">▼</button></div><div className="min-w-0 flex-1"><h2 className="font-bold">{section.name}</h2><p className="mt-1 text-xs text-stone-600">{section.description || section.slug}</p></div><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${section.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-100 text-stone-700'}`}>{section.isActive ? 'Active' : 'Hidden'}</span><button type="button" onClick={() => { setEditingId(section._id); setName(section.name); setDescription(section.description || ''); }} className="border border-stone-300 px-3 py-2 text-xs font-bold">Edit</button><button type="button" onClick={() => remove(section)} className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Delete</button></article>)}{sections.length === 0 && <div className="border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-600">সেকশন তৈরি করুন।</div>}</section><form onSubmit={save} className="space-y-4 border border-stone-200 bg-white p-5"><h2 className="font-bold">{editingId ? 'সেকশন সম্পাদনা' : 'সেকশন যোগ করুন'}</h2><label className="block text-sm font-semibold">নাম<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 font-normal" /></label><label className="block text-sm font-semibold">বিবরণ<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full border border-stone-300 p-3 font-normal" /></label><div className="flex gap-2"><button disabled={busy} className="min-h-10 flex-1 bg-[#dc2626] px-4 text-sm font-bold text-white">{busy ? 'সেভ হচ্ছে...' : 'সেভ করুন'}</button>{editingId && <button type="button" onClick={() => { setEditingId(''); setName(''); setDescription(''); }} className="border border-stone-300 px-4 text-sm font-bold">বাতিল</button>}</div></form></div></div>;
}
