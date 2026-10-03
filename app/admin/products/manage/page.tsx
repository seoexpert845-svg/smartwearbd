'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = {
  _id: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  imageUrl?: string;
};

export default function ManageProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/products')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'পণ্য লোড করা যায়নি।');
        if (mounted) setProducts(result.data);
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'পণ্য লোড করা যায়নি।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

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
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">পণ্য পরিচালনা</h1><p className="mt-1 text-sm text-stone-500">পণ্যের তথ্য সম্পাদনা করুন অথবা ক্যাটালগ থেকে সরান।</p></div><Link href="/admin/products/add" className="inline-flex min-h-10 items-center gap-2 bg-[#dc2626] px-4 text-sm font-bold text-white hover:bg-red-800"><span aria-hidden="true">+</span> নতুন পণ্য</Link></div>
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {loading ? <div className="border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">পণ্য লোড হচ্ছে...</div> : products.length === 0 ? <div className="border border-dashed border-stone-300 bg-white px-5 py-14 text-center"><h2 className="font-bold">ক্যাটালগ এখনো খালি</h2><Link href="/admin/products/add" className="mt-5 inline-flex bg-[#dc2626] px-5 py-3 text-sm font-bold text-white">প্রথম পণ্য যোগ করুন</Link></div> : <div className="overflow-x-auto border border-stone-200 bg-white"><table className="w-full min-w-220 text-left text-sm">
      <thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">পণ্য</th><th className="px-4 py-3">ক্যাটাগরি</th><th className="px-4 py-3">মূল্য</th><th className="px-4 py-3">স্টক</th><th className="px-4 py-3">অ্যাকশন</th></tr></thead>
      <tbody className="divide-y divide-stone-100">{products.map((product) => <tr key={product._id} className="hover:bg-stone-50"><td className="px-4 py-3"><div className="flex items-center gap-3">{product.imageUrl ? <img src={product.imageUrl} alt="" className="size-12 shrink-0 object-cover" /> : <span className="grid size-12 place-items-center bg-stone-100 text-stone-400">◇</span>}<strong>{product.name}</strong></div></td><td className="px-4 py-3 text-stone-600">{product.category}</td><td className="whitespace-nowrap px-4 py-3 font-bold">৳{new Intl.NumberFormat('bn-BD').format(product.price)}</td><td className="px-4 py-3">{new Intl.NumberFormat('bn-BD').format(product.stock)}</td><td className="px-4 py-3"><div className="flex items-center gap-2"><Link href={`/admin/products/${product._id}`} className="border border-stone-300 px-3 py-2 text-xs font-bold hover:border-[#dc2626] hover:text-[#dc2626]">সম্পাদনা</Link><button type="button" onClick={() => deleteProduct(product)} disabled={deletingId === product._id} className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{deletingId === product._id ? 'মুছছে...' : 'মুছুন'}</button></div></td></tr>)}</tbody>
    </table></div>}
  </div>;
}