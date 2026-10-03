'use client';

import { useEffect, useState } from 'react';

type Product = { _id: string; name: string; imageUrl: string; sku?: string; stock: number; stockAlertThreshold?: number; totalSales?: number; stockAlert?: boolean };

export default function ProductStockPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [selected, setSelected] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch('/api/products').then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'স্টক লোড করা যায়নি।');
      setProducts(result.data);
    }).catch((reason) => setError(reason instanceof Error ? reason.message : 'স্টক লোড করা যায়নি।'));
  }, []);

  const saveStock = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selected) return;
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/products/${selected._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stock: Number(quantity) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'স্টক আপডেট করা যায়নি।');
      setProducts((current) => current.map((product) => product._id === selected._id ? { ...product, stock: result.data.stock } : product));
      setSelected(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'স্টক আপডেট করা যায়নি।');
    } finally {
      setBusy(false);
    }
  };

  const alerts = products.filter((product) => product.stockAlert && product.stock <= (product.stockAlertThreshold ?? 5));
  return <div><header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#dc2626]">Inventory</p><h1 className="mt-1 text-2xl font-black">স্টক ম্যানেজমেন্ট</h1><p className="mt-1 text-sm text-stone-600">দ্রুত স্টক পরিবর্তন এবং বিক্রি হওয়া ইউনিট দেখুন।</p></header>{error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}{alerts.length > 0 && <div role="status" className="mb-4 border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950"><strong>লো-স্টক সতর্কতা · {alerts.length}টি পণ্য</strong><p className="mt-1">{alerts.map((product) => `${product.name} (${product.stock}টি)`).join(' · ')}</p></div>}<div className="overflow-x-auto border border-stone-200 bg-white"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-stone-50 text-xs font-bold text-stone-700"><tr><th className="px-4 py-3">পণ্য</th><th className="px-4 py-3">বর্তমান স্টক</th><th className="px-4 py-3">বিক্রীত ইউনিট</th><th className="px-4 py-3">অবস্থা</th><th className="px-4 py-3">অ্যাকশন</th></tr></thead><tbody className="divide-y divide-stone-100">{products.map((product) => { const threshold = product.stockAlertThreshold ?? 5; const status = product.stock < 1 ? 'Out of Stock' : product.stock <= threshold ? 'Low Stock' : 'In Stock'; return <tr key={product._id}><td className="px-4 py-3"><div className="flex items-center gap-3">{product.imageUrl && <img src={product.imageUrl} alt="" className="size-10 object-cover" />}<div><strong>{product.name}</strong><span className="block text-xs text-stone-600">{product.sku || 'SKU —'}</span></div></div></td><td className="px-4 py-3 font-bold">{product.stock}</td><td className="px-4 py-3">{product.totalSales || 0}</td><td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${status === 'In Stock' ? 'bg-emerald-100 text-emerald-800' : status === 'Low Stock' ? 'bg-amber-100 text-amber-900' : 'bg-red-100 text-red-800'}`}>{status}</span></td><td className="px-4 py-3"><button type="button" onClick={() => { setSelected(product); setQuantity(String(product.stock)); }} className="border border-stone-300 px-4 py-2 text-xs font-bold hover:border-[#dc2626]">Manage</button></td></tr>; })}</tbody></table></div>{selected && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><form onSubmit={saveStock} className="w-full max-w-md space-y-4 rounded-xl border border-stone-200 bg-white p-6 shadow-xl"><div className="flex items-start justify-between"><div><h2 className="text-lg font-bold">স্টক আপডেট</h2><p className="mt-1 text-sm text-stone-600">{selected.name}</p></div><button type="button" onClick={() => setSelected(null)} aria-label="বন্ধ করুন" className="rounded px-2 py-1 text-xl hover:bg-stone-100">×</button></div><label className="block text-sm font-semibold">Available quantity<input autoFocus required type="number" min="0" step="1" value={quantity} onChange={(event) => setQuantity(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3" /></label><div className="flex justify-end gap-2"><button type="button" onClick={() => setSelected(null)} className="border border-stone-300 px-4 py-2 text-sm font-bold">বাতিল</button><button disabled={busy} className="bg-[#dc2626] px-4 py-2 text-sm font-bold text-white disabled:opacity-60">{busy ? 'সেভ হচ্ছে...' : 'আপডেট'}</button></div></form></div>}</div>;
}
