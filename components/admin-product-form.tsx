'use client';

import { useEffect, useRef, useState } from 'react';
import { ImagePlus, Trash2, Upload } from 'lucide-react';

type Category = { _id: string; name: string; parentCategory?: string };
type SelectedImage = { file: File; preview: string };
type ProductFormData = {
  name: string; sku: string; category: string; subCategory: string; brand: string; sectionIds: string[];
  shortDescription: string; description: string; regularPrice: string; salePrice: string; buyingPrice: string; stock: string;
  productType: 'single' | 'variant'; variants: string; inStock: boolean; isPublic: boolean; featured: boolean;
  freeShipping: boolean; stockAlert: boolean; stockAlertThreshold: string; maxOrderQuantity: string; sortingRank: string;
  seoMetaTitle: string; seoMetaDescription: string; seoKeywords: string;
};
type CatalogOption = { _id: string; name: string; values?: string[] };

const emptyForm: ProductFormData = {
  name: '', sku: '', category: '', subCategory: '', brand: '', sectionIds: [], shortDescription: '', description: '',
  regularPrice: '', salePrice: '', buyingPrice: '', stock: '0', productType: 'single', variants: '[]',
  inStock: true, isPublic: true, featured: false, freeShipping: false, stockAlert: false,
  stockAlertThreshold: '5', maxOrderQuantity: '0', sortingRank: '0', seoMetaTitle: '', seoMetaDescription: '', seoKeywords: '',
};
const fieldClass = 'mt-1.5 h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm font-normal outline-none focus:border-[#1b3b2b] focus:ring-2 focus:ring-[#1b3b2b]/10';

function parseList(value: string) {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export default function AdminProductForm({ productId }: { productId?: string }) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<CatalogOption[]>([]);
  const [sections, setSections] = useState<CatalogOption[]>([]);
  const [attributes, setAttributes] = useState<CatalogOption[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string[]>>({});
  const [formData, setFormData] = useState<ProductFormData>(emptyForm);
  const [images, setImages] = useState<SelectedImage[]>([]);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const imagesRef = useRef(images);

  useEffect(() => { imagesRef.current = images; }, [images]);
  useEffect(() => () => imagesRef.current.forEach(({ preview }) => URL.revokeObjectURL(preview)), []);

  useEffect(() => {
    let mounted = true;
    Promise.all([
      fetch('/api/categories').then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটাগরি লোড করা যায়নি।');
        return result.data as Category[];
      }),
      ...(['brands', 'sections', 'variants'] as const).map((resource) => fetch(`/api/admin/catalog/${resource}`).then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটালগ অপশন লোড করা যায়নি।');
        return result.data as CatalogOption[];
      })),
    ]).then(([categoryData, brandData, sectionData, attributeData]) => {
      if (!mounted) return;
      setCategories(categoryData);
      setBrands(brandData);
      setSections(sectionData);
      setAttributes(attributeData);
    }).catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'ক্যাটালগ অপশন লোড করা যায়নি।'); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!productId) return;
    let mounted = true;
    fetch(`/api/products/${productId}`).then(async (response) => {
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'পণ্যের তথ্য পাওয়া যায়নি।');
      const product = result.data;
      if (!mounted) return;
      setFormData({
        name: product.name || '', sku: product.sku || '', category: product.category || '', subCategory: product.subCategory || '',
        brand: product.brand || '', sectionIds: product.sectionIds || [], shortDescription: product.shortDescription || '',
        description: product.description || '', regularPrice: String(product.regularPrice ?? product.price ?? ''),
        salePrice: String(product.salePrice ?? product.price ?? ''), buyingPrice: String(product.buyingPrice ?? ''),
        stock: String(product.stock ?? 0), productType: product.productType || 'single',
        variants: JSON.stringify(product.variants || [], null, 2), inStock: product.inStock !== false,
        isPublic: product.isPublic !== false, featured: product.featured === true, freeShipping: product.freeShipping === true,
        stockAlert: product.stockAlert === true, stockAlertThreshold: String(product.stockAlertThreshold ?? 5),
        maxOrderQuantity: String(product.maxOrderQuantity ?? 0), sortingRank: String(product.sortingRank ?? 0),
        seoMetaTitle: product.seoMetaTitle || '', seoMetaDescription: product.seoMetaDescription || '',
        seoKeywords: (product.seoKeywords || []).join(', '),
      });
      setExistingImages(product.images?.length ? product.images : product.imageUrl ? [product.imageUrl] : []);
    }).catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'পণ্য লোড করা যায়নি।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [productId]);

  const update = <K extends keyof ProductFormData>(key: K, value: ProductFormData[K]) =>
    setFormData((current) => ({ ...current, [key]: value }));

  const addFiles = (fileList: FileList | File[]) => {
    setError('');
    const chosen = Array.from(fileList);
    const valid = chosen.filter((file) => ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) && file.size <= 4 * 1024 * 1024);
    if (valid.length !== chosen.length) setError('শুধু JPG, PNG, WEBP বা GIF ছবি দিন; প্রতিটি ছবি সর্বোচ্চ ৪ MB।');
    const capacity = Math.max(0, 10 - existingImages.length - images.length);
    const nextFiles = valid.slice(0, capacity);
    if (nextFiles.length < valid.length) setError('সর্বোচ্চ ১০টি ছবি যোগ করা যাবে।');
    setImages((current) => [...current, ...nextFiles.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
  };

  const removeNewImage = (index: number) => setImages((current) => {
    const removed = current[index];
    if (removed) URL.revokeObjectURL(removed.preview);
    return current.filter((_, currentIndex) => currentIndex !== index);
  });

  const generateVariants = () => {
    const selected = attributes.flatMap((attribute) => {
      const values = selectedAttributes[attribute.name] || [];
      return values.length ? [{ name: attribute.name, values }] : [];
    });
    if (!selected.length) return setError('ভ্যারিয়েন্ট তৈরির আগে অন্তত একটি অ্যাট্রিবিউট ও ভ্যালু বেছে নিন।');
    const combinations = selected.reduce<Record<string, string>[]>((rows, attribute) =>
      rows.flatMap((row) => attribute.values.map((value) => ({ ...row, [attribute.name]: value }))), [{}]);
    if (combinations.length > 100) return setError('একবারে সর্বোচ্চ ১০০টি ভ্যারিয়েন্ট তৈরি করা যাবে।');
    update('variants', JSON.stringify(combinations.map((attributesMap) => ({ attributes: attributesMap, ...(Number(formData.salePrice) > 0 ? { price: Number(formData.salePrice) } : {}), stock: 0 })), null, 2));
    setError('');
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const imageCount = existingImages.length + images.length;
    if (imageCount < 1 || imageCount > 10) return setError('পণ্যের জন্য ১ থেকে ১০টি ছবি নির্বাচন করুন।');
    if (Number(formData.salePrice) > Number(formData.regularPrice)) return setError('বিক্রয় মূল্য মূল দামের বেশি হতে পারবে না।');
    let variants: unknown;
    try {
      variants = JSON.parse(formData.variants || '[]');
      if (!Array.isArray(variants) || variants.some((variant) => !variant || typeof variant !== 'object' || !variant.attributes || !Number.isInteger(Number(variant.stock)) || Number(variant.stock) < 0)) throw new Error();
    } catch {
      return setError('ভ্যারিয়েন্ট JSON সঠিক নয়; প্রতিটি রেকর্ডে attributes ও শূন্য বা তার বেশি পূর্ণসংখ্যা stock দিন।');
    }

    setSaving(true);
    try {
      const uploadedImages: string[] = [];
      if (images.length) {
        for (const { file } of images) {
          const uploadForm = new FormData();
          uploadForm.append('images', file);
          const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: uploadForm });
          const uploadResult = await uploadResponse.json();
          if (!uploadResponse.ok || !uploadResult.success || !uploadResult.data?.[0]) {
            throw new Error(uploadResult.error || 'ছবি আপলোড করা যায়নি।');
          }
          uploadedImages.push(uploadResult.data[0]);
        }
      }
      const payload = {
        ...formData,
        regularPrice: Number(formData.regularPrice), salePrice: Number(formData.salePrice), price: Number(formData.salePrice),
        buyingPrice: Number(formData.buyingPrice || 0), stock: formData.productType === 'variant' ? (variants as { stock: number }[]).reduce((sum, variant) => sum + Number(variant.stock), 0) : Number(formData.stock), stockAlertThreshold: Number(formData.stockAlertThreshold),
        maxOrderQuantity: Number(formData.maxOrderQuantity), sortingRank: Number(formData.sortingRank),
        variants, seoKeywords: parseList(formData.seoKeywords), images: [...existingImages, ...uploadedImages],
      };
      const response = await fetch(productId ? `/api/products/${productId}` : '/api/products', {
        method: productId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'প্রোডাক্ট সেভ করা যায়নি।');
      if (productId) {
        setExistingImages(payload.images);
        setSuccess('প্রোডাক্ট সফলভাবে আপডেট হয়েছে।');
      } else {
        setFormData(emptyForm);
        setExistingImages([]);
        setSuccess('প্রোডাক্ট সফলভাবে যোগ করা হয়েছে।');
      }
      images.forEach(({ preview }) => URL.revokeObjectURL(preview));
      setImages([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'একটি ত্রুটি ঘটেছে।');
    } finally {
      setSaving(false);
    }
  };

  const subCategories = categories.filter((category) => category.parentCategory === formData.category);
  const totalImages = existingImages.length + images.length;

  if (loading) return <div className="border border-stone-200 bg-white p-8 text-sm text-stone-600">পণ্যের তথ্য লোড হচ্ছে...</div>;
  return <div className="max-w-5xl">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#64766d]">Catalog</p><h1 className="mt-1 text-2xl font-black text-stone-900 sm:text-3xl">{productId ? 'পণ্য সম্পাদনা' : 'নতুন পণ্য যোগ করুন'}</h1><p className="mt-1 text-sm text-stone-600">পণ্যের তথ্য, মূল্য, ইনভেন্টরি, ভ্যারিয়েন্ট ও সার্চ প্রিভিউ পরিচালনা করুন।</p></div>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {success && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{success}</p>}
    <form onSubmit={submit} className="space-y-6 border border-stone-200 bg-white p-5 sm:p-8">
      <section className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-semibold text-stone-800 sm:col-span-2">পণ্যের নাম<input required maxLength={160} value={formData.name} onChange={(event) => update('name', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800">SKU<input maxLength={80} value={formData.sku} onChange={(event) => update('sku', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800">ক্যাটাগরি<select required value={formData.category} onChange={(event) => { update('category', event.target.value); update('subCategory', ''); }} className={fieldClass}><option value="">ক্যাটাগরি বেছে নিন</option>{categories.filter((category) => !category.parentCategory).map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-stone-800">সাব-ক্যাটাগরি<select value={formData.subCategory} onChange={(event) => update('subCategory', event.target.value)} className={fieldClass}><option value="">সাব-ক্যাটাগরি (ঐচ্ছিক)</option>{subCategories.map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-stone-800">ব্র্যান্ড<select value={formData.brand} onChange={(event) => update('brand', event.target.value)} className={fieldClass}><option value="">ব্র্যান্ড বেছে নিন</option>{brands.map((brand) => <option key={brand._id} value={brand.name}>{brand.name}</option>)}</select></label>
        <label className="block text-sm font-semibold text-stone-800 sm:col-span-2">হোমপেজ সেকশন<select multiple value={formData.sectionIds} onChange={(event) => update('sectionIds', Array.from(event.currentTarget.selectedOptions, (option) => option.value))} className="mt-1.5 min-h-24 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#1b3b2b]">{sections.map((section) => <option key={section._id} value={section._id}>{section.name}</option>)}</select><span className="mt-1 block text-xs font-normal text-stone-500">একাধিক সেকশন বেছে নিতে Ctrl/Command চেপে নির্বাচন করুন।</span></label>
      </section>
      <section className="rounded-lg border border-stone-200 bg-stone-50 p-4">
        <h2 className="font-bold text-stone-900">দাম ও লাভ</h2>
        <p className="mt-1 text-xs text-stone-600">ক্রয়মূল্য শুধু অ্যাডমিন রিপোর্ট ও ডেলিভার্ড অর্ডারের লাভ হিসাবের জন্য সংরক্ষিত থাকে।</p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block text-sm font-semibold text-stone-800">বিক্রয় মূল্য<input required type="number" min="0.01" step="0.01" value={formData.salePrice} onChange={(event) => update('salePrice', event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-semibold text-stone-800">মূল/রেগুলার মূল্য<input required type="number" min="0.01" step="0.01" value={formData.regularPrice} onChange={(event) => update('regularPrice', event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-semibold text-stone-800">ক্রয়মূল্য<input type="number" min="0" step="0.01" value={formData.buyingPrice} onChange={(event) => update('buyingPrice', event.target.value)} className={fieldClass} /></label>
          <label className="block text-sm font-semibold text-stone-800">স্টক পরিমাণ<input required type="number" min="0" step="1" value={formData.stock} onChange={(event) => update('stock', event.target.value)} className={fieldClass} /></label>
        </div>
      </section>
      <section className="space-y-4">
        <label className="block text-sm font-semibold text-stone-800">সংক্ষিপ্ত সারাংশ<textarea maxLength={500} rows={2} value={formData.shortDescription} onChange={(event) => update('shortDescription', event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal outline-none focus:border-[#1b3b2b]" /></label>
        <div><div className="mb-1 flex gap-2"><button type="button" onClick={() => update('description', `${formData.description}**লেখা**`)} className="rounded border border-stone-300 px-2 py-1 text-xs font-bold">Bold</button><button type="button" onClick={() => update('description', `${formData.description}*লেখা*`)} className="rounded border border-stone-300 px-2 py-1 text-xs italic">Italic</button><button type="button" onClick={() => update('description', `${formData.description}\n- তালিকার আইটেম`)} className="rounded border border-stone-300 px-2 py-1 text-xs">তালিকা</button></div><label className="block text-sm font-semibold text-stone-800">বিস্তারিত বিবরণ<textarea required maxLength={5000} rows={6} value={formData.description} onChange={(event) => update('description', event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm font-normal outline-none focus:border-[#1b3b2b]" /></label></div>
      </section>
      <section className="space-y-3 rounded-lg border border-stone-200 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-bold text-stone-900">পণ্যের ধরন ও ভ্যারিয়েন্ট</h2><p className="mt-1 text-xs text-stone-600">সাইজ, রং বা ওজনের কম্বিনেশন তৈরি করুন।</p></div><select value={formData.productType} onChange={(event) => update('productType', event.target.value as ProductFormData['productType'])} className="h-10 rounded border border-stone-300 bg-white px-3 text-sm"><option value="single">Single product</option><option value="variant">Product with variants</option></select></div>
        {formData.productType === 'variant' && <><div className="space-y-3">{attributes.map((attribute) => <fieldset key={attribute._id}><legend className="text-sm font-semibold text-stone-800">{attribute.name}</legend><div className="mt-1 flex flex-wrap gap-3">{(attribute.values || []).map((value) => <label key={value} className="inline-flex items-center gap-1.5 text-sm text-stone-700"><input type="checkbox" checked={(selectedAttributes[attribute.name] || []).includes(value)} onChange={(event) => setSelectedAttributes((current) => ({ ...current, [attribute.name]: event.target.checked ? [...(current[attribute.name] || []), value] : (current[attribute.name] || []).filter((item) => item !== value) }))} />{value}</label>)}</div></fieldset>)}</div><button type="button" onClick={generateVariants} className="rounded border border-[#1b3b2b] px-3 py-2 text-xs font-bold text-[#1b3b2b] hover:bg-[#f0f4f1]">কম্বিনেশন তৈরি করুন</button><label className="block text-sm font-semibold text-stone-800">ভ্যারিয়েন্ট তালিকা (JSON)<textarea rows={6} value={formData.variants} onChange={(event) => update('variants', event.target.value)} className="mt-1.5 w-full rounded border border-stone-300 p-3 font-mono text-xs font-normal outline-none focus:border-[#1b3b2b]" /></label></>}
      </section>
      <section className="grid gap-3 rounded-lg border border-stone-200 p-4 sm:grid-cols-2 lg:grid-cols-3">
        {([['inStock', 'ইন স্টক'], ['isPublic', 'স্টোরে প্রকাশিত'], ['featured', 'Featured'], ['freeShipping', 'ফ্রি শিপিং'], ['stockAlert', 'লো-স্টক সতর্কতা']] as const).map(([key, label]) => <label key={key} className="flex min-h-10 items-center gap-2 text-sm font-medium text-stone-800"><input type="checkbox" checked={formData[key]} onChange={(event) => update(key, event.target.checked)} className="size-4 accent-[#1b3b2b]" />{label}</label>)}
        <label className="block text-sm font-semibold text-stone-800">Stock Alert Threshold<input type="number" min="0" value={formData.stockAlertThreshold} onChange={(event) => update('stockAlertThreshold', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800">Max Order Quantity <span className="font-normal">(0 = সীমাহীন)</span><input type="number" min="0" value={formData.maxOrderQuantity} onChange={(event) => update('maxOrderQuantity', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800">Sorting Rank<input type="number" value={formData.sortingRank} onChange={(event) => update('sortingRank', event.target.value)} className={fieldClass} /></label>
      </section>
      <section aria-label="পণ্যের ছবি"><div className="mb-2 flex flex-wrap items-end justify-between gap-2"><div><h2 className="text-sm font-bold text-stone-800">পণ্যের ছবি</h2><p className="mt-1 text-xs text-stone-600">১ থেকে ১০টি ছবি · JPG, PNG, WEBP বা GIF · প্রতি ছবি সর্বোচ্চ ৪ MB</p></div><span className="text-xs font-semibold text-stone-600">{totalImages}/10</span></div>
        <label onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files); }} className="flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-stone-300 bg-[#faf9f5] px-4 py-6 text-center transition hover:border-[#1b3b2b] hover:bg-[#f3f5f1]"><input type="file" accept="image/jpeg,image/png,image/webp,image/gif" multiple disabled={totalImages >= 10} onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} className="sr-only" /><span className="grid size-11 place-items-center rounded-full bg-[#e7ede8] text-[#1b3b2b]"><ImagePlus className="size-5" /></span><span className="mt-3 text-sm font-bold text-stone-800">ছবি বেছে নিন বা এখানে ছেড়ে দিন</span><span className="mt-1 text-xs text-stone-600">একবারে একাধিক ফাইল নির্বাচন করা যাবে</span></label>
        {totalImages > 0 && <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{existingImages.map((url, index) => <li key={url} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"><img src={url} alt={`পণ্যের ছবি ${index + 1}`} className="size-full object-cover" /><button type="button" onClick={() => setExistingImages((current) => current.filter((_, currentIndex) => currentIndex !== index))} aria-label="ছবি সরান" className="absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-white/95 text-red-700 shadow hover:scale-105"><Trash2 className="size-4" /></button></li>)}{images.map((image, index) => <li key={`${image.file.name}-${index}`} className="group relative aspect-square overflow-hidden rounded-lg border border-stone-200 bg-stone-100"><img src={image.preview} alt={`${image.file.name} preview`} className="size-full object-cover" /><button type="button" onClick={() => removeNewImage(index)} aria-label={`${image.file.name} সরান`} title="ছবি সরান" className="absolute right-2 top-2 grid size-8 place-items-center rounded-md bg-white/95 text-red-700 shadow hover:scale-105"><Trash2 className="size-4" /></button></li>)}</ul>}
      </section>
      <section className="grid gap-4 rounded-lg border border-stone-200 p-4 sm:grid-cols-2">
        <h2 className="font-bold text-stone-900 sm:col-span-2">SEO ও সার্চ প্রিভিউ</h2>
        <label className="block text-sm font-semibold text-stone-800">SEO Meta Title<input maxLength={160} value={formData.seoMetaTitle} onChange={(event) => update('seoMetaTitle', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800">Keywords <span className="font-normal">(কমা দিয়ে আলাদা করুন)</span><input value={formData.seoKeywords} onChange={(event) => update('seoKeywords', event.target.value)} className={fieldClass} /></label>
        <label className="block text-sm font-semibold text-stone-800 sm:col-span-2">SEO Meta Description<textarea maxLength={320} rows={2} value={formData.seoMetaDescription} onChange={(event) => update('seoMetaDescription', event.target.value)} className="mt-1.5 w-full rounded-lg border border-stone-300 px-3 py-2 text-sm font-normal outline-none focus:border-[#1b3b2b]" /></label>
      </section>
      <button type="submit" disabled={saving} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-[#1b3b2b] px-5 text-sm font-bold text-white transition hover:bg-[#132e20] active:scale-[0.99] disabled:cursor-wait disabled:opacity-60"><Upload className="size-4" />{saving ? 'ছবি আপলোড ও পণ্য সেভ হচ্ছে…' : productId ? 'পরিবর্তন সেভ করুন' : 'প্রোডাক্ট যোগ করুন'}</button>
    </form>
  </div>;
}
