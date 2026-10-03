import ContactForm from '@/components/contact-form';

export default function ContactPage() {
  return <main className="min-h-screen bg-[#fdfbf7] px-4 py-12 sm:py-20">
    <div className="mx-auto max-w-2xl">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-800">Customer care</p>
      <h1 className="mt-2 text-3xl font-black text-stone-900">যোগাযোগ করুন</h1>
      <p className="mt-2 text-sm text-stone-600">আপনার প্রশ্ন বা মতামত পাঠান—আমাদের টিম যোগাযোগ করবে।</p>
      <ContactForm />
    </div>
  </main>;
}
