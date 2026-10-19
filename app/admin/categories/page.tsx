'use client';

import { useEffect, useState } from 'react';
import { ImagePlus, X } from 'lucide-react';

type Category = { _id: string; name: string; description: string; imageUrl?: string; productCount: number; parentCategory?: string };

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentCategory, setParentCategory] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState('');
  const [editingId, setEditingId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => () => {
    if (imagePreview.startsWith('blob:')) URL.revokeObjectURL(imagePreview);
  }, [imagePreview]);

  const loadCategories = async () => {
    const response = await fetch('/api/categories');
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটাগরি লোড করা যায়নি।');
    setCategories(result.data);
  };

  useEffect(() => {
    let mounted = true;
    fetch('/api/categories')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটাগরি লোড করা যায়নি।');
        if (mounted) setCategories(result.data);
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'ক্যাটাগরি লোড করা যায়নি।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const submitCategory = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      let categoryImageUrl = imageUrl;
      if (imageFile) {
        const uploadData = new FormData();
        uploadData.append('categoryImage', imageFile);
        const uploadResponse = await fetch('/api/uploads', { method: 'POST', body: uploadData });
        const uploadResult = await uploadResponse.json();
        if (!uploadResponse.ok || !uploadResult.success || !uploadResult.data?.[0]) {
          throw new Error(uploadResult.message || uploadResult.error || 'ক্যাটাগরির ছবি আপলোড করা যায়নি।');
        }
        categoryImageUrl = uploadResult.data[0];
      }
      const response = await fetch(editingId ? `/api/categories/${editingId}` : '/api/categories', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, description, imageUrl: categoryImageUrl, parentCategory }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || result.error || 'ক্যাটাগরি সেভ করা যায়নি।');
      setName('');
      setDescription('');
      setParentCategory('');
      setImageUrl('');
      setImageFile(null);
      setImagePreview('');
      setEditingId('');
      await loadCategories();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ক্যাটাগরি সেভ করা যায়নি।');
    } finally {
      setSaving(false);
    }
  };

  const clearForm = () => {
    setEditingId('');
    setName('');
    setDescription('');
    setParentCategory('');
    setImageUrl('');
    setImageFile(null);
    setImagePreview('');
  };

  const selectImage = (file?: File) => {
    setError('');
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size > 4 * 1024 * 1024) {
      setError('শুধু JPG, PNG, WEBP বা GIF ছবি দিন; ছবির সর্বোচ্চ আকার ৪ MB।');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const deleteCategory = async (category: Category) => {
    if (!window.confirm(`“${category.name}” ক্যাটাগরিটি মুছবেন?`)) return;
    setError('');
    try {
      const response = await fetch(`/api/categories/${category._id}`, { method: 'DELETE' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটাগরি মুছে ফেলা যায়নি।');
      setCategories((current) => current.filter((item) => item._id !== category._id));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'ক্যাটাগরি মুছে ফেলা যায়নি।');
    }
  };

  return <div>
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">ক্যাটাগরি</h1><p className="mt-1 text-sm text-stone-500">ক্যাটাগরি নাম বদলালে যুক্ত পণ্যগুলোর ক্যাটাগরিও হালনাগাদ হবে।</p></div>
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="overflow-x-auto border border-stone-200 bg-white"><table className="w-full min-w-150 text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">ছবি</th><th className="px-4 py-3">নাম</th><th className="px-4 py-3">ধরন</th><th className="px-4 py-3">বিবরণ</th><th className="px-4 py-3">পণ্য</th><th className="px-4 py-3">অ্যাকশন</th></tr></thead><tbody className="divide-y divide-stone-100">{loading ? <tr><td colSpan={6} className="px-4 py-8 text-center text-stone-500">ক্যাটাগরি লোড হচ্ছে...</td></tr> : categories.length ? categories.map((category) => <tr key={category._id} className="hover:bg-stone-50"><td className="px-4 py-3">{category.imageUrl ? <img src={category.imageUrl} alt="" className="size-12 rounded-md object-cover" /> : <span className="grid size-12 place-items-center rounded-md bg-stone-100 text-stone-400"><ImagePlus className="size-5" /></span>}</td><td className="px-4 py-3 font-bold">{category.name}</td><td className="px-4 py-3 text-xs">{category.parentCategory ? `সাব: ${category.parentCategory}` : 'মূল'}</td><td className="max-w-xs px-4 py-3 text-xs text-stone-500">{category.description || '—'}</td><td className="px-4 py-3">{new Intl.NumberFormat('bn-BD').format(category.productCount)}</td><td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => { setEditingId(category._id); setName(category.name); setDescription(category.description || ''); setParentCategory(category.parentCategory || ''); setImageUrl(category.imageUrl || ''); setImageFile(null); setImagePreview(category.imageUrl || ''); }} className="border border-stone-300 px-3 py-2 text-xs font-bold hover:border-[#dc2626] hover:text-[#dc2626]">সম্পাদনা</button><button type="button" onClick={() => deleteCategory(category)} className="border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50">মুছুন</button></div></td></tr>) : <tr><td colSpan={6} className="px-4 py-10 text-center text-stone-500">কোনো ক্যাটাগরি নেই।</td></tr>}</tbody></table></section>
      <form onSubmit={submitCategory} className="space-y-4 border border-stone-200 bg-white p-5"><h2 className="font-extrabold">{editingId ? 'ক্যাটাগরি সম্পাদনা' : 'নতুন ক্যাটাগরি'}</h2><label className="block text-sm font-semibold">ক্যাটাগরির নাম<input required value={name} onChange={(event) => setName(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 px-3 font-normal outline-none focus:border-[#dc2626]" placeholder="যেমন: ইলেকট্রনিকস" /></label><label className="block text-sm font-semibold">মূল ক্যাটাগরি<select value={parentCategory} onChange={(event) => setParentCategory(event.target.value)} className="mt-1.5 h-11 w-full border border-stone-300 bg-white px-3 font-normal"><option value="">মূল ক্যাটাগরি (Parent)</option>{categories.filter((category) => !category.parentCategory && category._id !== editingId).map((category) => <option key={category._id} value={category.name}>{category.name}</option>)}</select></label><label className="block text-sm font-semibold">বিবরণ (ঐচ্ছিক)<textarea rows={3} value={description} onChange={(event) => setDescription(event.target.value)} className="mt-1.5 w-full border border-stone-300 px-3 py-2 font-normal outline-none focus:border-[#dc2626]" /></label><div><label className="block text-sm font-semibold">ক্যাটাগরির ছবি (ঐচ্ছিক)<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={(event) => selectImage(event.target.files?.[0])} className="mt-1.5 block w-full text-xs file:mr-3 file:rounded-md file:border-0 file:bg-stone-100 file:px-3 file:py-2 file:font-bold hover:file:bg-stone-200" /></label><p className="mt-1 text-[10px] text-stone-500">JPG, PNG, WEBP বা GIF · সর্বোচ্চ ৪ MB</p>{imagePreview && <div className="relative mt-3 w-fit"><img src={imagePreview} alt="ক্যাটাগরি ছবির প্রিভিউ" className="size-24 rounded-md border border-stone-200 object-cover" /><button type="button" onClick={() => { setImageFile(null); setImageUrl(''); setImagePreview(''); }} aria-label="ক্যাটাগরির ছবি সরান" className="absolute -right-2 -top-2 grid size-7 place-items-center rounded-full bg-white text-stone-700 shadow ring-1 ring-stone-200"><X className="size-4" /></button></div>}</div><div className="flex gap-2"><button type="submit" disabled={saving} className="min-h-10 bg-[#dc2626] px-4 text-sm font-bold text-white hover:bg-red-800 disabled:opacity-60">{saving ? 'সেভ হচ্ছে...' : editingId ? 'পরিবর্তন সেভ' : 'ক্যাটাগরি যোগ করুন'}</button>{editingId && <button type="button" onClick={clearForm} className="border border-stone-300 px-4 text-sm font-bold">বাতিল</button>}</div></form>
    </div>
  </div>;
}