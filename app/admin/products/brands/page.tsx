import AdminCatalogManager from '@/components/admin-catalog-manager';

export default function ProductBrandsPage() {
  return <div><header className="mb-6"><p className="text-xs font-bold uppercase tracking-widest text-[#dc2626]">Catalog</p><h1 className="mt-1 text-2xl font-black">ব্র্যান্ড</h1></header><AdminCatalogManager resource="brands" title="সব ব্র্যান্ড" description="ব্র্যান্ড পণ্যের তথ্য ও ফিল্টারে ব্যবহার করা হবে।" /></div>;
}
