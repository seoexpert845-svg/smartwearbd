import { notFound } from 'next/navigation';
import connectDB from '@/lib/db';
import SiteSetting from '@/models/SiteSetting';

export const dynamic = 'force-dynamic';

type PageProps = { params: Promise<{ slug: string }> };

export default async function StorePolicyPage({ params }: PageProps) {
  const { slug } = await params;
  if (!/^[a-z0-9-]{2,64}$/.test(slug)) notFound();
  await connectDB();
  const settings = await SiteSetting.findOne({ key: 'store' }).select('storeName policyPages').lean();
  const pages = settings?.policyPages;
  if (!pages || typeof pages !== 'object' || Array.isArray(pages)) notFound();
  const page = (pages as Record<string, unknown>)[slug];
  if (!page || typeof page !== 'object' || Array.isArray(page)) notFound();
  const title = 'title' in page && typeof page.title === 'string' ? page.title : '';
  const content = 'content' in page && typeof page.content === 'string' ? page.content : '';
  if (!title && !content) notFound();

  return <main className="min-h-screen bg-[#fdfbf7] px-4 py-12 text-stone-900 sm:px-8">
    <article className="mx-auto max-w-3xl rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-10">
      <p className="text-xs font-bold uppercase tracking-widest text-stone-500">{settings?.storeName || 'Store'}</p>
      <h1 className="mt-2 text-3xl font-black">{title}</h1>
      <div className="mt-8 whitespace-pre-wrap text-sm leading-7 text-stone-700">{content}</div>
    </article>
  </main>;
}
