import Link from 'next/link';
import { notFound } from 'next/navigation';
import CourierManagement from '@/components/courier-management';
import AccountingManagement from '@/components/accounting-management';
import MessagesManagement from '@/components/messages-management';
import LandingPagesManagement from '@/components/landing-pages-management';

const toolPages: Record<string, { eyebrow: string; title: string; description: string; status: string; details: string[] }> = {
  reports: {
    eyebrow: 'Analytics',
    title: 'রিপোর্ট',
    description: 'অর্ডার অ্যাক্টিভিটি ও জনপ্রিয় পণ্যের লাইভ সারাংশ ড্যাশবোর্ডে দেখা যাচ্ছে।',
    status: 'সারাংশ প্রস্তুত',
    details: ['গত ৭ দিনের অর্ডার চার্ট', 'টপ সেলিং পণ্যের পরিমাণ ও বিক্রয়মূল্য', 'সম্পূর্ণ অর্ডার তালিকা'],
  },
  courier: {
    eyebrow: 'Delivery integrations',
    title: 'কুরিয়ার সংযোগ',
    description: 'Steadfast বা Pathao API credentials যোগ না করা পর্যন্ত এখান থেকে বুকিং পাঠানো হবে না।',
    status: 'সংযুক্ত নয়',
    details: ['Steadfast merchant credentials প্রয়োজন', 'Pathao client credentials প্রয়োজন', 'বুকিং হলে tracking ID অর্ডারে সংরক্ষিত হবে'],
  },
  sms: {
    eyebrow: 'Notifications',
    title: 'SMS Gateway',
    description: 'SMS provider নির্বাচন ও API credentials সংরক্ষণ না হওয়া পর্যন্ত বার্তা পাঠানো বন্ধ থাকবে।',
    status: 'সেটআপ প্রয়োজন',
    details: ['Provider API key প্রয়োজন', 'Sender ID যাচাই প্রয়োজন', 'Order status notification টেমপ্লেট প্রস্তুত করতে হবে'],
  },
  accounting: {
    eyebrow: 'Finance',
    title: 'অ্যাকাউন্টিং',
    description: 'বর্তমান অর্ডারভিত্তিক বিক্রয় সারাংশ ব্যবহার করুন; payment reconciliation এখনো সংযুক্ত নয়।',
    status: 'সারাংশ মোড',
    details: ['মোট অর্ডার ভ্যালু ড্যাশবোর্ডে দেখানো হয়', 'Refund ও gateway settlement এখনো sync হয় না', 'আলাদা ledger export পরবর্তী integration'],
  },
  messages: {
    eyebrow: 'Customer care',
    title: 'মেসেজ',
    description: 'কাস্টমার যোগাযোগের চ্যানেল যুক্ত হলে inbox এখানে দেখানো হবে।',
    status: 'ইনবক্স সংযুক্ত নয়',
    details: ['WhatsApp বা Messenger webhook প্রয়োজন', 'কাস্টমার পরিচয় phone number দিয়ে মিলবে', 'কোনো incoming message এখনো সংরক্ষণ করা হয় না'],
  },
  'landing-pages': {
    eyebrow: 'Campaigns',
    title: 'ল্যান্ডিং পেজ',
    description: 'প্রচারমূলক landing page publishing এখনো চালু হয়নি। Store banner settings থেকে homepage campaign সম্পাদনা করুন।',
    status: 'সেটআপ প্রয়োজন',
    details: ['Homepage banner ও offer সম্পাদনা করা যায়', 'Campaign-specific page publishing এখনো নেই', 'প্রকাশের আগে preview workflow যোগ করতে হবে'],
  },
};

export default async function AdminToolPage({ params }: { params: Promise<{ tool: string }> }) {
  const { tool } = await params;
  if (tool === 'courier') return <CourierManagement />;
  if (tool === 'accounting') return <AccountingManagement />;
  if (tool === 'messages') return <MessagesManagement />;
  if (tool === 'landing-pages') return <LandingPagesManagement />;
  const page = toolPages[tool];
  if (!page) notFound();

  return <div className="max-w-4xl">
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">{page.eyebrow}</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">{page.title}</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{page.description}</p></div>
    <section className="border border-stone-200 bg-white p-5 sm:p-7">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-200 pb-4"><div><p className="text-xs font-semibold text-stone-500">সার্ভিস স্ট্যাটাস</p><p className="mt-1 font-bold text-stone-900">{page.status}</p></div><span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-bold text-amber-800"><span aria-hidden="true">●</span> {page.status}</span></div>
      <ul className="mt-5 space-y-3">{page.details.map((detail) => <li key={detail} className="flex items-start gap-3 text-sm text-stone-700"><span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-teal-50 text-xs font-bold text-teal-800">✓</span>{detail}</li>)}</ul>
      <div className="mt-7 flex flex-wrap gap-3"><Link href={tool === 'reports' || tool === 'accounting' ? '/admin' : '/admin/settings'} className="inline-flex min-h-10 items-center justify-center bg-teal-800 px-4 text-sm font-bold text-white hover:bg-teal-900">{tool === 'reports' || tool === 'accounting' ? 'ড্যাশবোর্ড দেখুন' : 'সেটিংস খুলুন'}</Link>{tool === 'courier' && <span className="inline-flex min-h-10 cursor-not-allowed items-center border border-stone-200 bg-stone-50 px-4 text-sm font-semibold text-stone-500" title="Integration credentials are not configured">কুরিয়ার বুকিং বন্ধ</span>}</div>
    </section>
  </div>;
}