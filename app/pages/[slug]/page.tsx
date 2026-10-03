import { cookies } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import connectDB from '@/lib/db';
import { SESSION_COOKIE, verifySession } from '@/lib/auth';
import LandingPage from '@/models/LandingPage';
import Product from '@/models/Product';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await connectDB();
  const page = await LandingPage.findOne({ slug, status: 'published' }).select('title metaTitle metaDescription metaKeywords').lean();
  if (!page) return {};
  return {
    title: page.metaTitle || page.title,
    description: page.metaDescription || undefined,
    keywords: page.metaKeywords ? String(page.metaKeywords).split(',').map((keyword: string) => keyword.trim()).filter(Boolean) : undefined,
  };
}

type LandingSection = {
  _id: unknown; type: string; layout: string; title: string; subtitle: string; content: string;
  buttonText: string; buttonUrl: string; mediaUrl: string; images: string[];
};
type LandingProduct = { _id: unknown; name: string; price: number; salePrice?: number; images?: string[]; imageUrl?: string };

function youtubeEmbedUrl(value: string) {
  try {
    const url = new URL(value);
    const isShortUrl = url.hostname === 'youtu.be';
    if (!isShortUrl && url.hostname !== 'youtube.com' && !url.hostname.endsWith('.youtube.com')) return '';
    const videoId = isShortUrl ? url.pathname.slice(1) : url.pathname === '/watch' ? url.searchParams.get('v') || '' : url.pathname.split('/').filter(Boolean).at(-1) || '';
    return /^[A-Za-z0-9_-]{11}$/.test(videoId) ? `https://www.youtube-nocookie.com/embed/${videoId}` : '';
  } catch {
    return '';
  }
}

export default async function PublishedLandingPage({ params, searchParams }: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ preview?: string }>;
}) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const preview = query.preview === '1';
  if (preview) {
    const cookieStore = await cookies();
    const session = verifySession(cookieStore.get(SESSION_COOKIE)?.value);
    if (session?.role !== 'admin') notFound();
  }

  await connectDB();
  const page = await LandingPage.findOne({ slug, ...(preview ? {} : { status: 'published' }) }).lean();
  if (!page) notFound();
  const sections = page.sections as LandingSection[];
  const products: LandingProduct[] = page.featuredProducts.length
    ? await Product.find({ _id: { $in: page.featuredProducts }, isPublic: { $ne: false } }).select('name price regularPrice salePrice images imageUrl').lean()
    : [];
  return <main style={{ '--campaign-color': page.primaryColor, fontFamily: page.fontFamily } as React.CSSProperties} className="min-h-screen bg-white text-stone-900">
    {page.headerTemplate !== 'minimal' && <header className="border-b border-stone-200 px-5 py-5"><div className={`mx-auto flex max-w-6xl items-center ${page.headerTemplate === 'campaign' ? 'justify-center' : 'justify-between'}`}><Link href="/" className="text-lg font-black">{page.headerTemplate === 'campaign' ? page.title : 'Store'}</Link>{page.headerTemplate === 'standard' && <Link href="/" className="text-sm font-bold">Shop all</Link>}</div></header>}
    {preview && <div className="bg-amber-100 px-4 py-2 text-center text-xs font-bold text-amber-900">Admin preview · {page.status}</div>}
    <div className="mx-auto max-w-6xl">
      {sections.map((section) => <section key={String(section._id)} className={`px-5 py-14 sm:py-20 ${section.type === 'hero' ? 'bg-[var(--campaign-color)] text-white' : ''}`}>
        <div className={`mx-auto grid max-w-5xl items-center gap-8 ${section.type === 'hero' && section.layout === 'split' ? 'md:grid-cols-2' : ''} ${section.type === 'hero' && section.layout === 'centered' ? 'text-center' : ''}`}>
          <div><h2 className="text-3xl font-black sm:text-5xl">{section.title}</h2>{section.subtitle && <p className="mt-4 text-base leading-7 opacity-80">{section.subtitle}</p>}{section.type === 'features' || section.type === 'feature-list' ? <ul className={`mt-5 grid gap-3 ${section.type === 'features' ? 'sm:grid-cols-2' : ''}`}>{section.content.split('\n').map((feature) => feature.trim()).filter(Boolean).map((feature, index) => <li key={`${feature}-${index}`} className="flex items-start gap-3 rounded-lg border border-stone-200/70 p-4"><span aria-hidden="true" className="grid size-7 shrink-0 place-items-center rounded-full bg-[var(--campaign-color)] text-sm font-bold text-white">{section.type === 'features' ? '✓' : '✦'}</span><span>{feature}</span></li>)}</ul> : section.content && <p className="mt-5 whitespace-pre-wrap leading-7">{section.content}</p>}{section.buttonText && <a href={section.buttonUrl || '#products'} className="mt-6 inline-flex rounded-lg bg-[var(--campaign-color)] px-5 py-3 text-sm font-bold text-white">{section.buttonText}</a>}</div>
          {section.mediaUrl && <div className="overflow-hidden rounded-xl">{youtubeEmbedUrl(section.mediaUrl) ? <iframe title={section.title || 'Campaign video'} src={youtubeEmbedUrl(section.mediaUrl)} allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowFullScreen className="aspect-video w-full" /> : <img src={section.mediaUrl} alt={section.title} className="max-h-[520px] w-full object-cover" />}</div>}
        </div>
        {section.images?.length > 0 && <div className="mx-auto mt-8 grid max-w-5xl grid-cols-2 gap-3 md:grid-cols-4">{section.images.map((image, index) => <img key={`${image}-${index}`} src={image} alt="" className="aspect-square w-full rounded-lg object-cover" />)}</div>}
      </section>)}
      {products.length > 0 && <section id="products" className="grid gap-4 px-5 py-12 sm:grid-cols-2 lg:grid-cols-4">{products.map((product) => <a href={`/products/${product._id}`} key={String(product._id)} className="overflow-hidden rounded-xl border border-stone-200"><img src={product.images?.[0] || product.imageUrl || ''} alt={product.name} className="aspect-square w-full object-cover" /><div className="p-4"><h2 className="font-bold">{product.name}</h2><p className="mt-1 font-extrabold text-[var(--campaign-color)]">৳{product.salePrice || product.price}</p></div></a>)}</section>}
    </div>
  </main>;
}
