import AdminCatalogManager from '@/components/admin-catalog-manager';

export default function ProductVariantsPage() {
  return <div><header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black">প্রোডাক্ট ভ্যারিয়েন্ট</h1></header><AdminCatalogManager resource="variants" title="Global variant attributes" description="Size, Color, Weight-এর মতো অ্যাট্রিবিউট ও অপশন পরিচালনা করুন।" /></div>;
}
