'use client';

import { useEffect, useState } from 'react';

type Review = { _id: string; reviewerName: string; rating: number; text: string; imageUrl?: string; verifiedBuyer: boolean; createdAt: string };

export default function ProductReviews({ productId }: { productId: string }) {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [rating, setRating] = useState('5');
  const [text, setText] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetch(`/api/products/${productId}/reviews`).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'রিভিউ লোড করা যায়নি।');
      if (active) setReviews(result.data);
    }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : 'রিভিউ লোড করা যায়নি।'); });
    return () => { active = false; };
  }, [productId]);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true); setError(''); setMessage('');
    try {
      const response = await fetch(`/api/products/${productId}/reviews`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating: Number(rating), text }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'রিভিউ জমা দেওয়া যায়নি।');
      setText('');
      setMessage('রিভিউ জমা হয়েছে। অ্যাডমিন অনুমোদনের পর প্রকাশিত হবে।');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'রিভিউ জমা দেওয়া যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  return <section className="mx-auto mt-8 max-w-6xl border-t border-stone-200 px-4 py-8 sm:px-6">
    <h2 className="text-xl font-bold text-stone-900">গ্রাহক রিভিউ</h2>
    {error && <p role="alert" className="mt-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {reviews.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2">{reviews.map((review) => <article key={review._id} className="rounded-lg border border-stone-200 bg-white p-4"><div className="flex items-center justify-between gap-2"><strong className="text-sm">{review.reviewerName}</strong><span className="text-amber-600" aria-label={`${review.rating} out of 5 stars`}>{'★'.repeat(review.rating)}{'☆'.repeat(5 - review.rating)}</span></div>{review.verifiedBuyer && <span className="mt-1 inline-block text-xs font-bold text-emerald-800">Verified buyer</span>}<p className="mt-2 whitespace-pre-wrap text-sm text-stone-700">{review.text}</p>{review.imageUrl && <img src={review.imageUrl} alt="গ্রাহকের সংযুক্ত ছবি" className="mt-3 max-h-48 object-contain" />}</article>)}</div> : <p className="mt-3 text-sm text-stone-600">এখনো কোনো অনুমোদিত রিভিউ নেই।</p>}
    <form onSubmit={submit} className="mt-6 max-w-xl space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-4"><h3 className="font-bold">আপনার রিভিউ দিন</h3><p className="text-xs text-stone-600">শুধু এই পণ্যের ডেলিভার্ড অর্ডার থাকা সাইন-ইন গ্রাহক রিভিউ দিতে পারবেন। রিভিউ অনুমোদনের পর প্রকাশিত হবে।</p>{message && <p role="status" className="text-sm font-semibold text-emerald-800">{message}</p>}<label className="block text-sm font-semibold">রেটিং<select value={rating} onChange={(event) => setRating(event.target.value)} className="mt-1 h-10 w-full border border-stone-300 bg-white px-3">{[5, 4, 3, 2, 1].map((value) => <option key={value} value={value}>{value} / 5</option>)}</select></label><label className="block text-sm font-semibold">রিভিউ<textarea required minLength={3} maxLength={3000} rows={4} value={text} onChange={(event) => setText(event.target.value)} className="mt-1 w-full border border-stone-300 bg-white p-3 font-normal" /></label><button disabled={saving} className="rounded bg-[#1b3b2b] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60">{saving ? 'জমা হচ্ছে...' : 'রিভিউ জমা দিন'}</button></form>
  </section>;
}
