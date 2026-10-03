'use client';

import { useCallback, useEffect, useState, type DragEvent, type FormEvent } from 'react';
import { ArrowDown, ArrowLeft, ArrowUp, Eye, GripVertical, Pencil, Plus, Save, Trash2 } from 'lucide-react';

type Section = {
  _id?: string; type: 'hero' | 'features' | 'gallery' | 'feature-list' | 'text'; layout: 'centered' | 'split';
  title: string; subtitle: string; mediaUrl: string; buttonText: string; buttonUrl: string; content: string; images: string[];
};
type LandingPageData = {
  _id: string; title: string; slug: string; status: 'published' | 'draft' | 'demo'; sections: Section[];
  headerTemplate: 'standard' | 'minimal' | 'campaign'; metaTitle: string; metaDescription: string; metaKeywords: string;
  fontFamily: string; primaryColor: string; featuredProducts: string[]; updatedAt: string;
};
type Product = { _id: string; name: string; sku?: string; price?: number; imageUrl?: string };
type Editor = Omit<LandingPageData, '_id' | 'updatedAt'>;
const emptySection = (type: Section['type']): Section => ({ type, layout: type === 'hero' ? 'split' : 'centered', title: '', subtitle: '', mediaUrl: '', buttonText: '', buttonUrl: '', content: '', images: [] });
const blankEditor = (): Editor => ({ title: '', slug: '', status: 'draft', sections: [emptySection('hero')], headerTemplate: 'standard', metaTitle: '', metaDescription: '', metaKeywords: '', fontFamily: 'Hind Siliguri', primaryColor: '#123d3a', featuredProducts: [] });
const field = 'h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-700';
const statusLabel: Record<LandingPageData['status'], string> = { published: 'Published', draft: 'Draft', demo: 'Demo' };

function toSlug(title: string) {
  return title.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function LandingPagesManagement() {
  const [pages, setPages] = useState<LandingPageData[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [editor, setEditor] = useState<Editor>(blankEditor());
  const [editingId, setEditingId] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    try {
      const [pageResponse, productResponse] = await Promise.all([fetch('/api/admin/tools/landing-pages', { cache: 'no-store' }), fetch('/api/products', { cache: 'no-store' })]);
      const [pageResult, productResult] = await Promise.all([pageResponse.json(), productResponse.json()]);
      if (!pageResponse.ok || !pageResult.success) throw new Error(pageResult.error || 'Landing pages could not be loaded.');
      if (!productResponse.ok || !productResult.success) throw new Error(productResult.error || 'Products could not be loaded.');
      setError('');
      setPages(pageResult.data);
      setProducts(productResult.data.map((product: Product) => ({ _id: product._id, name: product.name, sku: product.sku, price: product.price, imageUrl: product.imageUrl })));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Landing pages could not be loaded.');
    } finally { setLoading(false); }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const openNew = () => { setEditor(blankEditor()); setEditingId(''); setIsEditing(true); setError(''); setNotice(''); };
  const openEdit = (page: LandingPageData) => {
    setEditor({
      title: page.title, slug: page.slug, status: page.status, sections: page.sections,
      headerTemplate: page.headerTemplate, metaTitle: page.metaTitle, metaDescription: page.metaDescription,
      metaKeywords: page.metaKeywords, fontFamily: page.fontFamily, primaryColor: page.primaryColor,
      featuredProducts: page.featuredProducts,
    });
    setEditingId(page._id); setIsEditing(true); setError(''); setNotice('');
  };

  const updateSection = (index: number, patch: Partial<Section>) => setEditor((current) => ({
    ...current, sections: current.sections.map((section, sectionIndex) => sectionIndex === index ? { ...section, ...patch } : section),
  }));
  const moveSection = (from: number, to: number) => setEditor((current) => {
    if (to < 0 || to >= current.sections.length) return current;
    const sections = [...current.sections];
    const [section] = sections.splice(from, 1);
    sections.splice(to, 0, section!);
    return { ...current, sections };
  });

  const uploadMedia = async (index: number, file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const body = new FormData(); body.set('settingsImage', file);
      const response = await fetch('/api/uploads', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.success || !result.data?.[0]) throw new Error(result.error || 'Media upload failed.');
      updateSection(index, { mediaUrl: result.data[0] });
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Media upload failed.'); }
    finally { setBusy(false); }
  };

  const save = async (event: FormEvent<HTMLFormElement>, status: Editor['status']) => {
    event.preventDefault();
    setBusy(true); setError(''); setNotice('');
    try {
      const payload = { ...editor, status };
      const response = await fetch(editingId ? `/api/admin/tools/landing-pages/${editingId}` : '/api/admin/tools/landing-pages', {
        method: editingId ? 'PATCH' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Landing page could not be saved.');
      setNotice(`Saved as ${statusLabel[status]}`);
      await load();
      setEditingId(result.data._id);
      setEditor((current) => ({ ...current, status }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Landing page could not be saved.');
    } finally { setBusy(false); }
  };

  const removePage = async (page: LandingPageData) => {
    if (!window.confirm(`Delete “${page.title}”?`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/tools/landing-pages/${page._id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Landing page could not be deleted.');
      setPages((current) => current.filter((item) => item._id !== page._id));
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Landing page could not be deleted.'); }
    finally { setBusy(false); }
  };

  const preview = (page: Pick<Editor, 'slug' | 'status'>, pageId = editingId) => {
    if (!pageId) { setError('Save this page first, then preview it.'); return; }
    if (!page.slug) { setError('Set a valid slug before previewing.'); return; }
    window.open(`/pages/${encodeURIComponent(page.slug)}?preview=1`, '_blank', 'noopener,noreferrer');
  };
  const reorderDrop = (event: DragEvent<HTMLElement>, target: number) => {
    event.preventDefault();
    if (dragIndex !== null) moveSection(dragIndex, target);
    setDragIndex(null);
  };

  return <main className="max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Campaigns</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Landing Pages</h1><p className="mt-1 text-sm text-stone-600">Build, preview and publish campaign pages with product selections.</p></div>{editingId || editor.title ? <button type="button" onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-4 text-sm font-bold"><Plus className="size-4" />New page</button> : <button type="button" onClick={openNew} className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white"><Plus className="size-4" />Create landing page</button>}</header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {isEditing ? <form onSubmit={(event) => {
      const status = (event.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
      void save(event, (status?.value || editor.status) as Editor['status']);
    }} className="space-y-5">
      <section className="grid gap-4 rounded-2xl border border-stone-200 bg-white p-5 sm:grid-cols-2 sm:p-6">
        <label className="text-sm font-bold">Title *<input required maxLength={160} value={editor.title} onChange={(event) => setEditor((current) => ({ ...current, title: event.target.value, ...(!editingId && !current.slug ? { slug: toSlug(event.target.value) } : {}) }))} className={`${field} mt-1`} /></label>
        <label className="text-sm font-bold">URL slug *<div className="mt-1 flex items-center gap-2"><span className="text-xs text-stone-500">/pages/</span><input required pattern="[a-z0-9]+(?:-[a-z0-9]+)*" value={editor.slug} onChange={(event) => setEditor((current) => ({ ...current, slug: toSlug(event.target.value) }))} className={field} /></div></label>
        <label className="text-sm font-bold">Header template<select value={editor.headerTemplate} onChange={(event) => setEditor((current) => ({ ...current, headerTemplate: event.target.value as Editor['headerTemplate'] }))} className={`${field} mt-1`}><option value="standard">Standard store header</option><option value="minimal">No header</option><option value="campaign">Campaign centered header</option></select></label>
        <label className="text-sm font-bold">Font<select value={editor.fontFamily} onChange={(event) => setEditor((current) => ({ ...current, fontFamily: event.target.value }))} className={`${field} mt-1`}>{['Hind Siliguri', 'SolaimanLipi', 'Kalpurush', 'Noto Sans Bengali'].map((font) => <option key={font}>{font}</option>)}</select></label>
        <label className="text-sm font-bold">Primary color<div className="mt-1 flex h-10 items-center gap-3 rounded-lg border border-stone-300 px-2"><input type="color" value={editor.primaryColor} onChange={(event) => setEditor((current) => ({ ...current, primaryColor: event.target.value }))} /><span className="text-xs font-normal">{editor.primaryColor}</span></div></label>
        <label className="text-sm font-bold">Featured products<select multiple value={editor.featuredProducts} onChange={(event) => setEditor((current) => ({ ...current, featuredProducts: Array.from(event.target.selectedOptions, (option) => option.value) }))} className={`${field} mt-1 h-28 py-2`}>{products.map((product) => <option key={product._id} value={product._id}>{product.name}{product.sku ? ` · ${product.sku}` : ''}</option>)}</select><span className="mt-1 block text-[11px] font-normal text-stone-500">Use Ctrl / Cmd to select multiple products.</span></label>
        <label className="text-sm font-bold">Meta title<input maxLength={160} value={editor.metaTitle} onChange={(event) => setEditor((current) => ({ ...current, metaTitle: event.target.value }))} className={`${field} mt-1`} /></label>
        <label className="text-sm font-bold">Meta keywords<input maxLength={500} value={editor.metaKeywords} onChange={(event) => setEditor((current) => ({ ...current, metaKeywords: event.target.value }))} className={`${field} mt-1`} /></label>
        <label className="text-sm font-bold sm:col-span-2">Meta description<textarea maxLength={320} rows={2} value={editor.metaDescription} onChange={(event) => setEditor((current) => ({ ...current, metaDescription: event.target.value }))} className={`${field} mt-1 h-auto py-2`} /></label>
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><header className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Page sections</h2><p className="mt-1 text-xs text-stone-500">Drag sections to reorder, or use the arrow controls.</p></div><select aria-label="Add section template" value="" onChange={(event) => { if (event.target.value) setEditor((current) => ({ ...current, sections: [...current.sections, emptySection(event.target.value as Section['type'])] })); }} className={`${field} max-w-52`}><option value="">Add section template…</option><option value="hero">Hero section</option><option value="features">Product features</option><option value="gallery">Image gallery</option><option value="feature-list">Feature list</option><option value="text">Text block</option></select></header>
        <div className="space-y-3">{editor.sections.map((section, index) => <article key={section._id || `section-${index}`} draggable onDragStart={() => setDragIndex(index)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => reorderDrop(event, index)} onDragEnd={() => setDragIndex(null)} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
          <div className="mb-3 flex items-center justify-between gap-2"><span className="inline-flex items-center gap-2 text-xs font-extrabold uppercase text-teal-900"><GripVertical className="size-4" />{index + 1}. {section.type.replace('-', ' ')}</span><div className="flex gap-1"><button type="button" disabled={!index} aria-label="Move section up" onClick={() => moveSection(index, index - 1)} className="grid size-8 place-items-center rounded-lg hover:bg-white disabled:opacity-30"><ArrowUp className="size-4" /></button><button type="button" disabled={index === editor.sections.length - 1} aria-label="Move section down" onClick={() => moveSection(index, index + 1)} className="grid size-8 place-items-center rounded-lg hover:bg-white disabled:opacity-30"><ArrowDown className="size-4" /></button><button type="button" aria-label="Remove section" onClick={() => setEditor((current) => ({ ...current, sections: current.sections.filter((_, sectionIndex) => sectionIndex !== index) }))} className="grid size-8 place-items-center rounded-lg text-red-700 hover:bg-red-50"><Trash2 className="size-4" /></button></div></div>
          <div className="grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold">Section title<input maxLength={240} value={section.title} onChange={(event) => updateSection(index, { title: event.target.value })} className={`${field} mt-1`} /></label><label className="text-xs font-bold">Layout<select value={section.layout} onChange={(event) => updateSection(index, { layout: event.target.value as Section['layout'] })} className={`${field} mt-1`}><option value="centered">Centered</option><option value="split">Split</option></select></label><label className="text-xs font-bold sm:col-span-2">Subtitle<input maxLength={2000} value={section.subtitle} onChange={(event) => updateSection(index, { subtitle: event.target.value })} className={`${field} mt-1`} /></label>
            <label className="text-xs font-bold sm:col-span-2">Image URL or YouTube URL<div className="mt-1 flex gap-2"><input type="text" value={section.mediaUrl} onChange={(event) => updateSection(index, { mediaUrl: event.target.value })} placeholder="https://… or /uploads/…" className={field} /><label className="inline-flex h-10 shrink-0 cursor-pointer items-center rounded-lg border border-stone-300 bg-white px-3 text-xs font-bold">Upload<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => { void uploadMedia(index, event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" /></label></div></label>
            {section.type === 'gallery' && <label className="text-xs font-bold sm:col-span-2">Gallery images (one URL per line)<textarea rows={3} value={section.images.join('\n')} onChange={(event) => updateSection(index, { images: event.target.value.split('\n').map((image) => image.trim()).filter(Boolean) })} className={`${field} mt-1 h-auto py-2`} /></label>}
            {section.type !== 'hero' && <label className="text-xs font-bold sm:col-span-2">Content / feature list<textarea maxLength={10000} rows={3} value={section.content} onChange={(event) => updateSection(index, { content: event.target.value })} className={`${field} mt-1 h-auto py-2`} /></label>}
            <label className="text-xs font-bold">CTA button text<input maxLength={80} value={section.buttonText} onChange={(event) => updateSection(index, { buttonText: event.target.value })} className={`${field} mt-1`} /></label><label className="text-xs font-bold">CTA button link<input type="text" value={section.buttonUrl} onChange={(event) => updateSection(index, { buttonUrl: event.target.value })} className={`${field} mt-1`} /></label>
          </div>
        </article>)}</div>
      </section>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-stone-200 bg-white p-4"><div className="flex gap-2"><button type="button" onClick={() => preview(editor)} className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-bold"><Eye className="size-4" />Preview</button>{editingId && <span className="self-center text-xs text-stone-500">Current status: {statusLabel[editor.status]}</span>}</div><div className="flex flex-wrap gap-2"><button disabled={busy} value="demo" type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-bold disabled:opacity-50"><Save className="size-4" />Save Demo</button><button disabled={busy} value="draft" type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 px-3 text-sm font-bold disabled:opacity-50">Save Draft</button><button disabled={busy} value="published" type="submit" className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50">Publish</button></div></div>
      <button type="button" onClick={() => setIsEditing(false)} className="inline-flex items-center gap-2 text-sm font-bold text-stone-600"><ArrowLeft className="size-4" />Back to landing page list</button>
    </form> : <section className="overflow-hidden rounded-xl border border-stone-200 bg-white">    <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-stone-50 text-[11px] font-bold uppercase text-stone-500"><tr>{['Title', 'Slug', 'Status', 'Sections', 'Updated', 'Actions'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{pages.map((page) => <tr key={page._id} className="hover:bg-stone-50"><td className="px-4 py-4 font-bold">{page.title}</td><td className="px-4 py-4 text-stone-500">/pages/{page.slug}</td><td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${page.status === 'published' ? 'bg-emerald-50 text-emerald-800' : page.status === 'demo' ? 'bg-violet-50 text-violet-800' : 'bg-stone-100 text-stone-700'}`}>{statusLabel[page.status]}</span></td><td className="px-4 py-4">{page.sections.length}</td><td className="px-4 py-4 text-xs text-stone-500">{new Date(page.updatedAt).toLocaleDateString()}</td><td className="px-4 py-4"><div className="flex gap-2"><button type="button" onClick={() => openEdit(page)} aria-label="Edit landing page" className="grid size-9 place-items-center rounded-lg border border-stone-200 hover:bg-stone-100"><Pencil className="size-4" /></button><button type="button" onClick={() => preview(page, page._id)} aria-label="Preview landing page" className="grid size-9 place-items-center rounded-lg border border-stone-200 hover:bg-stone-100"><Eye className="size-4" /></button><button type="button" disabled={busy} onClick={() => void removePage(page)} aria-label="Delete landing page" className="grid size-9 place-items-center rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 className="size-4" /></button></div></td></tr>)}</tbody></table></div>{!loading && !pages.length && <p className="p-10 text-center text-sm text-stone-500">No landing pages yet. Create your first campaign page.</p>}{loading && <p className="p-8 text-center text-sm text-stone-500">Loading landing pages...</p>}</section>}
  </main>;
}
