'use client';

import { useEffect, useState } from 'react';

type Product = { _id: string; name: string };
type Review = { _id: string; productId: string; productName: string; reviewerName: string; phone: string; rating: number; text: string; imageUrl?: string; status: 'Pending' | 'Approved' | 'Rejected'; verifiedBuyer: boolean; createdAt: string };

export default function ProductReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productId, setProductId] = useState('');
  const [reviewerName, setReviewerName] = useState('');
  const [phone, setPhone] = useState('');
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const endpoint = '/api/admin/catalog/reviews';

  const load = async () => {
    const [reviewResponse, productResponse] = await Promise.all([fetch(endpoint), fetch('/api/products')]);
    const [reviewResult, productResult] = await Promise.all([reviewResponse.json(), productResponse.json()]);
    if (!reviewResponse.ok || !reviewResult.success) throw new Error(reviewResult.error || 'রিভিউ লোড করা যায়নি।');
    if (!productResponse.ok || !productResult.success) throw new Error(productResult.error || 'পণ্য লোড করা যায়নি।');
    setReviews(reviewResult.data);
    setProducts(productResult.data);
  };
  useEffect(() => {
    let active = true;
    Promise.all([fetch(endpoint), fetch('/api/products')])
      .then(async ([reviewResponse, productResponse]) => {
        const [reviewResult, productResult] = await Promise.all([reviewResponse.json(), productResponse.json()]);
        if (!reviewResponse.ok || !reviewResult.success) throw new Error(reviewResult.error || 'রিভিউ লোড করা যায়নি।');
        if (!productResponse.ok || !productResult.success) throw new Error(productResult.error || 'পণ্য লোড করা যায়নি।');
        if (active) { setReviews(reviewResult.data); setProducts(productResult.data); }
      })
      .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'ডেটা লোড করা যায়নি।'); });
    return () => { active = false; };
  }, []);

  const createReview = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      let imageUrl = '';
      if (screenshot) {
        const form = new FormData();
        form.append('reviewImage', screenshot);
        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: form });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success) throw new Error(uploadResult.message || uploadResult.error || 'স্ক্রিনশট আপলোড করা যায়নি।');
        imageUrl = uploadResult.data[0];
      }
      const selectedProduct = products.find((product) => product._id === productId);
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ productId, productName: selectedProduct?.name, reviewerName, phone, rating: Number(rating), text, imageUrl }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'রিভিউ যোগ করা যায়নি।');
      setReviewerName(''); setPhone(''); setText(''); setScreenshot(null); setRating('5');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'রিভিউ যোগ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const moderate = async (review: Review, status: Review['status']) => {
    const response = await fetch(`${endpoint}?id=${review._id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }) });
    const result = await response.json();
    if (!response.ok || !result.success) return setError(result.error || 'রিভিউ আপডেট করা যায়নি।');
    setReviews((current) => current.map((entry) => entry._id === review._id ? { ...entry, status } : entry));
  };
  const remove = async (review: Review) => {
    if (!window.confirm('রিভিউটি মুছে ফেলবেন?')) return;
    const response = await fetch(`${endpoint}?id=${review._id}`, { method: 'DELETE' });
    const result = await response.json();
    if (!response.ok || !result.success) return setError(result.error || 'রিভিউ মুছতে ব্যর্থ হয়েছে।');
    setReviews((current) => current.filter((entry) => entry._id !== review._id));
  };

  return <div><header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black">রিভিউ ও ভেরিফিকেশন</h1><p className="mt-1 text-sm text-stone-600">গ্রাহকের Pending রিভিউ অনুমোদন করুন বা অ্যাডমিন রিভিউ যোগ করুন।</p></header>{error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}<div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_350px]"><section className="space-y-3">{reviews.map((review) => <article key={review._id} className="border border-stone-200 bg-white p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-bold">{review.reviewerName} <span className="text-amber-600">{'★'.repeat(review.rating)}</span></h2><p className="mt-1 text-xs text-stone-600">{review.productName} · {review.phone || 'ফোন নেই'} · {new Date(review.createdAt).toLocaleDateString()}</p></div><div className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${review.status === 'Approved' ? 'bg-emerald-100 text-emerald-800' : review.status === 'Pending' ? 'bg-amber-100 text-amber-900' : 'bg-stone-100 text-stone-700'}`}>{review.status}</span>{review.verifiedBuyer && <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-bold text-blue-800">Verified buyer</span>}</div></div><p className="mt-3 whitespace-pre-wrap text-sm text-stone-800">{review.text}</p>{review.imageUrl && <a href={review.imageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block text-xs font-bold text-blue-700 underline">স্ক্রিনশট দেখুন</a>}<div className="mt-3 flex flex-wrap gap-2"><button type="button" onClick={() => moderate(review, 'Approved')} className="border border-emerald-300 px-3 py-2 text-xs font-bold text-emerald-800">Approve</button><button type="button" onClick={() => moderate(review, 'Rejected')} className="border border-amber-300 px-3 py-2 text-xs font-bold text-amber-900">Reject</button><button type="button" onClick={() => remove(review)} className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700">Delete</button></div></article>)}{reviews.length === 0 && <div className="border border-dashed border-stone-300 bg-white p-10 text-center text-sm text-stone-600">এখনো কোনো রিভিউ নেই।</div>}</section><form onSubmit={createReview} className="space-y-4 border border-stone-200 bg-white p-5"><h2 className="font-bold">ম্যানুয়ালি রিভিউ যোগ করুন</h2><label className="block text-sm font-semibold">পণ্য<select required value={productId} onChange={(event) => setProductId(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 bg-white px-3 font-normal"><option value="">পণ্য বেছে নিন</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select></label><label className="block text-sm font-semibold">গ্রাহকের নাম<input required value={reviewerName} onChange={(event) => setReviewerName(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 font-normal" /></label><label className="block text-sm font-semibold">ফোন<input value={phone} onChange={(event) => setPhone(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 font-normal" /></label><label className="block text-sm font-semibold">রেটিং<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 bg-white px-3 font-normal">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} star{'★'.repeat(value)}</option>)}</select></label><label className="block text-sm font-semibold">রিভিউ<textarea required minLength={3} maxLength={3000} rows={4} value={text} onChange={(event) => setText(event.target.value)} className="mt-1.5 w-full border border-stone-300 p-3 font-normal" /></label><label className="block text-sm font-semibold">স্ক্রিনশট (ঐচ্ছিক)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => setScreenshot(event.target.files?.[0] || null)} className="mt-1.5 block w-full text-xs font-normal" /></label><button disabled={saving} className="min-h-10 w-full bg-[#dc2626] px-4 text-sm font-bold text-white disabled:opacity-60">{saving ? 'সেভ হচ্ছে...' : 'Approved রিভিউ তৈরি করুন'}</button></form></div></div>;
}
