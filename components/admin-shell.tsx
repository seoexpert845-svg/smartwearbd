'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Activity, Boxes, ChartNoAxesCombined, ChevronLeft, ChevronRight, CircleDollarSign, LogOut, Menu,
  BadgeCheck, Command, FolderKanban, Headset, LayoutDashboard, Layers3, PackagePlus, PanelLeftClose,
  PanelLeftOpen, Ruler, Settings2, ShoppingBag, Star, Truck, Users, X,
} from 'lucide-react';
import { normalizeImageUrl } from '@/lib/image-url';

const navigation = [
  { href: '/admin', label: 'ড্যাশবোর্ড', icon: LayoutDashboard, exact: true, group: 'ওভারভিউ' },
  { href: '/admin/orders', label: 'অর্ডার', icon: ShoppingBag, group: 'ওভারভিউ' },
  { href: '/admin/products', label: 'পণ্যসমূহ', icon: Boxes, group: 'ক্যাটালগ' },
  { href: '/admin/products/add', label: 'পণ্য যোগ করুন', icon: PackagePlus, group: 'ক্যাটালগ' },
  { href: '/admin/products/stocks', label: 'স্টক ম্যানেজমেন্ট', icon: BadgeCheck, group: 'ক্যাটালগ' },
  { href: '/admin/categories', label: 'সব ক্যাটাগরি', icon: FolderKanban, group: 'ক্যাটালগ' },
  { href: '/admin/products/sections', label: 'সব সেকশন', icon: Layers3, group: 'ক্যাটালগ' },
  { href: '/admin/products/brands', label: 'সব ব্র্যান্ড', icon: CircleDollarSign, group: 'ক্যাটালগ' },
  { href: '/admin/products/variants', label: 'প্রোডাক্ট ভ্যারিয়েন্ট', icon: Ruler, group: 'ক্যাটালগ' },
  { href: '/admin/products/reviews', label: 'সব রিভিউ', icon: Star, group: 'ক্যাটালগ' },
  { href: '/admin/customers', label: 'কাস্টমার', icon: Users, group: 'বিজনেস' },
  { href: '/admin/tools/reports', label: 'রিপোর্ট ও অ্যানালিটিক্স', icon: ChartNoAxesCombined, group: 'বিজনেস' },
  { href: '/admin/tools/courier', label: 'কুরিয়ার ম্যানেজমেন্ট', icon: Truck, group: 'বিজনেস' },
  { href: '/admin/tools/accounting', label: 'অ্যাকাউন্টিং', icon: CircleDollarSign, group: 'বিজনেস' },
  { href: '/admin/tools/sms', label: 'SMS Gateway', icon: Activity, group: 'চ্যানেল' },
  { href: '/admin/tools/messages', label: 'মেসেজ ও সাপোর্ট', icon: Headset, group: 'চ্যানেল' },
  { href: '/admin/tools/landing-pages', label: 'ল্যান্ডিং পেজ', icon: Command, group: 'চ্যানেল' },
  { href: '/admin/settings', label: 'সেটিংস', icon: Settings2, group: 'সিস্টেম' },
];

export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenu, setMobileMenu] = useState({ pathname: '', open: false });
  const mobileMenuOpen = mobileMenu.open && mobileMenu.pathname === pathname;
  const [storeName, setStoreName] = useState('ঘরবাজার');
  const [logoUrl, setLogoUrl] = useState('');

  useEffect(() => {
    const loadBranding = () => fetch('/api/settings')
      .then((response) => response.json())
      .then((result) => {
        if (result.success) {
          setStoreName(result.data.storeName || 'ঘরবাজার');
          setLogoUrl(normalizeImageUrl(result.data.logoUrl || ''));
        }
      })
      .catch(() => undefined);

    loadBranding();
    const refreshBranding = () => loadBranding();
    window.addEventListener('store-settings-updated', refreshBranding);
    return () => window.removeEventListener('store-settings-updated', refreshBranding);
  }, []);

  const toggleSidebar = () => setCollapsed((current) => {
    const next = !current;
    window.localStorage.setItem('admin-sidebar-collapsed', String(next));
    return next;
  });
  const activeItem = navigation.filter((item) => item.exact ? pathname === item.href : pathname.startsWith(item.href)).sort((a, b) => b.href.length - a.href.length)[0];
  useEffect(() => {
    if (!mobileMenuOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileMenu((current) => ({ ...current, open: false }));
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [mobileMenuOpen]);
  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/admin/login');
    router.refresh();
  };

  if (pathname === '/admin/login') return <>{children}</>;

  return (
    <div className={`admin-theme min-h-screen lg:flex ${collapsed ? 'admin-collapsed' : ''}`}>
      {mobileMenuOpen && <button type="button" aria-label="মেনু বন্ধ করুন" className="admin-mobile-backdrop fixed inset-0 z-40 lg:hidden" onClick={() => setMobileMenu((current) => ({ ...current, open: false }))} />}
      <aside id="admin-navigation-drawer" aria-label="অ্যাডমিন মেনু" className={`admin-sidebar flex flex-col lg:fixed lg:inset-y-0 ${mobileMenuOpen ? 'is-mobile-open' : ''}`}>
        <div className="admin-brand flex items-center justify-between px-4 py-5">
          <Link href="/admin" className="flex min-w-0 items-center gap-3" title={storeName}>
            <span className="admin-brand-mark grid size-10 shrink-0 place-items-center overflow-hidden rounded-xl">
              {logoUrl ? <img src={logoUrl} alt="" className="size-full object-contain" /> : <span>{storeName.slice(0, 1)}</span>}
            </span>
            <span className="admin-brand-copy min-w-0"><strong className="block truncate text-sm">{storeName}</strong><span className="text-[10px] uppercase tracking-[0.16em]">Admin Console</span></span>
          </Link>
          <div className="flex items-center gap-3"><span className="admin-online size-2 shrink-0 rounded-full" title="সিস্টেম অনলাইন" /><button type="button" onClick={() => setMobileMenu((current) => ({ ...current, open: false }))} aria-label="মেনু বন্ধ করুন" className="admin-drawer-close grid size-10 place-items-center rounded-lg text-white hover:bg-white/10 lg:hidden"><X className="size-5" /></button></div>
        </div>
        <div className="admin-workspace hidden px-5 py-5 lg:block"><p className="text-[10px] font-bold uppercase tracking-[0.16em]">Workspace</p><p className="mt-2 text-sm font-semibold">Store management</p></div>
        <nav aria-label="অ্যাডমিন নেভিগেশন" className="admin-navigation flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-y-auto lg:px-3 lg:py-2">
          {navigation.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            const groupStart = navigation.findIndex((navItem) => navItem.group === item.group) === navigation.indexOf(item);
            return <div key={item.href} className="admin-nav-entry">
              {groupStart && <p className="admin-nav-group hidden px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] lg:block">{item.group}</p>}
              <Link href={item.href} aria-current={active ? 'page' : undefined} title={collapsed ? item.label : undefined} onClick={() => setMobileMenu((current) => ({ ...current, open: false }))} className={`admin-nav-link flex shrink-0 items-center gap-3 px-3 py-2.5 text-sm font-semibold transition lg:w-full ${active ? 'is-active' : ''}`}>
                <Icon aria-hidden="true" className="size-[18px] shrink-0" strokeWidth={1.8} /><span className="admin-nav-label">{item.label}</span>
              </Link>
            </div>;
          })}
        </nav>
        <div className="admin-sidebar-footer mt-auto hidden p-3 lg:block">
          <Link href="/" title="স্টোরফ্রন্টে ফিরুন" className="admin-nav-link flex items-center gap-3 px-3 py-2.5 text-sm font-semibold"><ChevronLeft className="size-[18px] shrink-0" /><span className="admin-nav-label">স্টোরফ্রন্টে ফিরুন</span></Link>
          <button type="button" onClick={toggleSidebar} aria-label={collapsed ? 'সাইডবার প্রসারিত করুন' : 'সাইডবার সংকুচিত করুন'} className="admin-collapse mt-2 flex w-full items-center gap-3 px-3 py-2.5 text-sm font-semibold">
            {collapsed ? <PanelLeftOpen className="size-[18px] shrink-0" /> : <PanelLeftClose className="size-[18px] shrink-0" />}<span className="admin-nav-label">{collapsed ? 'মেনু প্রসারিত' : 'মেনু সংকুচিত'}</span><ChevronRight className="admin-collapse-chevron ml-auto size-4" />
          </button>
          <p className="admin-copyright mt-3 px-3 text-[10px]">© 2026 {storeName}</p>
        </div>
      </aside>
      <div className={`admin-content min-w-0 flex-1 ${collapsed ? 'lg:ml-[5.25rem]' : 'lg:ml-[17rem]'}`}>
        <header className="admin-topbar flex min-h-16 items-center justify-between gap-2 px-3 py-2 sm:px-7">
          <div className="flex min-w-0 items-center gap-2 sm:gap-3"><button type="button" aria-controls="admin-navigation-drawer" aria-expanded={mobileMenuOpen} onClick={() => setMobileMenu({ pathname, open: !mobileMenuOpen })} aria-label={mobileMenuOpen ? 'অ্যাডমিন মেনু বন্ধ করুন' : 'অ্যাডমিন মেনু খুলুন'} className="admin-menu-toggle grid size-10 shrink-0 place-items-center rounded-lg lg:hidden"><Menu className="size-5" /></button><div className="min-w-0"><p className="hidden text-[10px] font-bold uppercase tracking-[0.15em] sm:block">{storeName}</p><p className="truncate text-sm font-semibold">{activeItem?.label || 'অ্যাডমিন'}</p></div></div>
          <div className="flex items-center gap-2"><button type="button" onClick={signOut} aria-label="অ্যাডমিন থেকে সাইন আউট" title="সাইন আউট" className="admin-store-link grid size-9 shrink-0 place-items-center rounded-full"><LogOut className="size-4" /></button><Link href="/" className="admin-store-link inline-flex shrink-0 items-center gap-2 rounded-full px-3 py-2 text-xs font-bold sm:px-4"><ShoppingBag className="size-4" /><span>স্টোর দেখুন</span></Link></div>
        </header>
        <main className="mx-auto w-full max-w-360 p-4 sm:p-7"><div key={pathname} className="admin-page-enter">{children}</div></main>
      </div>
    </div>
  );
}