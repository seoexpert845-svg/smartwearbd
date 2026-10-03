'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { normalizeImageUrl } from '@/lib/image-url';

type Product = {
  _id: string; name: string; category: string; description: string; price: number; regularPrice?: number;
  stock: number; imageUrl: string; brand?: string; sku?: string; totalSales?: number; stockAlertThreshold?: number;
  isPublic?: boolean; inStock?: boolean; netProfit?: number;
};

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categoryFilter, setCategoryFilter] = useState('');
  const [brandFilter, setBrandFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/products')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'পণ্য লোড করা যায়নি।');
        if (mounted) setProducts(result.data);
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'পণ্যের তালিকা লোড করা যায়নি।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const categories = useMemo(() => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(), [products]);
  const brands = useMemo(() => [...new Set(products.map((product) => product.brand).filter((brand): brand is string => Boolean(brand)))].sort(), [products]);
  const filteredProducts = products.filter((product) => (!categoryFilter || product.category === categoryFilter) && (!brandFilter || product.brand === brandFilter));

  const deleteProduct = async (product: Product) => {
    if (!window.confirm(`“${product.name}” পণ্যটি মুছে ফেলবেন?`)) return;
    setDeletingId(product._id);
    setError('');
    try {
      const response = await fetch(`/api/products/${product._id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'পণ্য মুছে ফেলা যায়নি।');
      setProducts((current) => current.filter((item) => item._id !== product._id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'পণ্য মুছে ফেলা যায়নি।');
    } finally {
      setDeletingId('');
    }
  };

  return <div>
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">পণ্যসমূহ</h1><p className="mt-1 text-sm text-stone-600">মূল্য, বিক্রয়, ক্যাটাগরি ও ইনভেন্টরি পরিচালনা করুন।</p></div><Link href="/admin/products/add" className="inline-flex min-h-10 items-center gap-2 bg-[#dc2626] px-4 text-sm font-bold text-white transition hover:bg-red-800 active:scale-[0.98]"><span aria-hidden="true">+</span> নতুন পণ্য</Link></div>
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-3"><div className="border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-600">মোট পণ্য</p><p className="mt-2 text-2xl font-black">{loading ? '—' : new Intl.NumberFormat('bn-BD').format(products.length)}</p></div><div className="border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-600">ক্যাটাগরি</p><p className="mt-2 text-2xl font-black">{loading ? '—' : new Intl.NumberFormat('bn-BD').format(categories.length)}</p></div><div className="col-span-2 border border-stone-200 bg-white p-4 sm:col-span-1"><p className="text-xs font-bold uppercase tracking-wide text-stone-600">কম স্টক</p><p className="mt-2 text-2xl font-black">{loading ? '—' : new Intl.NumberFormat('bn-BD').format(products.filter((product) => product.stock <= (product.stockAlertThreshold ?? 5)).length)}</p></div></div>
    <div className="mb-4 flex flex-wrap gap-3 border border-stone-200 bg-white p-3"><label className="text-xs font-bold text-stone-700">ক্যাটাগরি<select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="ml-2 h-9 min-w-40 border border-stone-300 bg-white px-2 text-sm font-normal"><option value="">সব ক্যাটাগরি</option>{categories.map((category) => <option key={category}>{category}</option>)}</select></label><label className="text-xs font-bold text-stone-700">ব্র্যান্ড<select value={brandFilter} onChange={(event) => setBrandFilter(event.target.value)} className="ml-2 h-9 min-w-40 border border-stone-300 bg-white px-2 text-sm font-normal"><option value="">সব ব্র্যান্ড</option>{brands.map((brand) => <option key={brand}>{brand}</option>)}</select></label><p className="ml-auto self-center text-xs text-stone-600">{filteredProducts.length}টি পণ্য</p></div>
    {loading ? <div className="border border-stone-200 bg-white p-8 text-center text-sm text-stone-600">পণ্য লোড হচ্ছে...</div> : filteredProducts.length === 0 ? <div className="border border-dashed border-stone-300 bg-white px-5 py-14 text-center"><h2 className="font-bold">কোনো পণ্য পাওয়া যায়নি</h2><p className="mt-1 text-sm text-stone-600">ফিল্টার পরিবর্তন করুন অথবা নতুন পণ্য যোগ করুন।</p></div> : <div className="overflow-x-auto border border-stone-200 bg-white"><table className="w-full min-w-[1200px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-600"><tr><th className="px-3 py-3">Sl</th><th className="px-3 py-3">পণ্য</th><th className="px-3 py-3">বিক্রয় মূল্য</th><th className="px-3 py-3">মূল্য</th><th className="px-3 py-3">ক্যাটাগরি</th><th className="px-3 py-3">ব্র্যান্ড</th><th className="px-3 py-3">স্টক স্ট্যাটাস</th><th className="px-3 py-3">মোট বিক্রয়</th><th className="px-3 py-3">ডেলিভার্ড লাভ</th><th className="px-3 py-3">অ্যাকশন</th></tr></thead><tbody className="divide-y divide-stone-100">{filteredProducts.map((product, index) => {
      const imageUrl = normalizeImageUrl(product.imageUrl);
      const lowStock = product.stock <= (product.stockAlertThreshold ?? 5);
      return <tr key={product._id} className="transition-colors hover:bg-stone-50"><td className="px-3 py-3 text-stone-600">{index + 1}</td><td className="px-3 py-3"><div className="flex items-center gap-3">{imageUrl ? <img src={imageUrl} alt="" className="size-11 shrink-0 object-cover" /> : <span className="grid size-11 place-items-center bg-stone-100 text-stone-500">◇</span>}<span className="min-w-0"><strong className="block max-w-xs truncate">{product.name}</strong><span className="mt-1 block text-xs text-stone-600">{product.sku || 'SKU —'}</span></span></div></td><td className="whitespace-nowrap px-3 py-3 font-bold">৳{new Intl.NumberFormat('bn-BD').format(product.price)}</td><td className="whitespace-nowrap px-3 py-3 text-stone-700">৳{new Intl.NumberFormat('bn-BD').format(product.regularPrice ?? product.price)}</td><td className="px-3 py-3 text-stone-700">{product.category}</td><td className="px-3 py-3 text-stone-700">{product.brand || '—'}</td><td className="px-3 py-3"><span className={`inline-flex border px-2 py-1 text-xs font-bold ${product.stock === 0 || product.inStock === false ? 'border-red-200 bg-red-50 text-red-800' : lowStock ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>{product.stock === 0 || product.inStock === false ? 'স্টক শেষ' : lowStock ? 'কম স্টক' : 'স্টকে আছে'}</span></td><td className="px-3 py-3">{new Intl.NumberFormat('bn-BD').format(product.totalSales || 0)}</td><td className="whitespace-nowrap px-3 py-3 text-emerald-800">৳{new Intl.NumberFormat('bn-BD').format(product.netProfit || 0)}</td><td className="px-3 py-3"><div className="flex items-center gap-1.5"><Link href={`/products/${product._id}`} target="_blank" className="border border-stone-300 px-2 py-2 text-xs font-bold hover:bg-stone-50">View</Link><Link href={`/admin/products/${product._id}`} className="border border-stone-300 px-2 py-2 text-xs font-bold hover:border-[#dc2626] hover:text-[#dc2626]">Edit</Link><button type="button" onClick={() => deleteProduct(product)} disabled={deletingId === product._id} className="border border-red-200 px-2 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingId === product._id ? '…' : 'Delete'}</button></div></td></tr>;
    })}</tbody></table></div>}
  </div>;
}
