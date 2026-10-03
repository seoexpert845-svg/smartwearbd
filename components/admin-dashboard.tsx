'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Activity, AlertTriangle, Bell, CalendarDays, Check, ChevronDown, CircleDollarSign, Clock3, LoaderCircle, MessageSquareText, Plus, RefreshCw, ShoppingBag, ShoppingCart, Users, X } from 'lucide-react';
import { findBangladeshDistrict, getBangladeshUpazilas } from '@/lib/bangladesh-locations';
import { normalizeImageUrl } from '@/lib/image-url';
import SearchableDistrictSelect from '@/components/searchable-district-select';

type Period = 'today' | 'yesterday' | 'custom';
type MetricPeriod = { start: string; end: string; totalOrders: number; totalRevenue: number; totalItems: number; totalCustomers: number };
type DashboardData = {
  period: MetricPeriod;
  statuses: { label: string; count: number }[];
  sources: { label: string; count: number }[];
  hourly: { hour: number; count: number }[];
  health: { real: number; fake: number };
  activity: { date: string; count: number }[];
  topProducts: { id: string; name: string; quantity: number; revenue: number; imageUrl: string }[];
  regions: { name: string; count: number }[];
  employees: { name: string; Pending: number; Confirmed: number; Delivered: number; Cancelled: number }[];
  inventory: { lowStockCount: number; outOfStockCount: number; products: { id: string; name: string; price: number; imageUrl: string; stock: number }[] };
  notifications: { id: string; customerName: string; totalAmount: number; status: string; createdAt: string }[];
  sms: { configured: boolean; balance: number | null };
};

const money = (amount: number) => `৳${new Intl.NumberFormat('bn-BD').format(amount || 0)}`;
const number = (value: number) => new Intl.NumberFormat('bn-BD').format(value || 0);
const dateInput = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};
const dateLabel = (value: string) => new Date(`${value}T00:00:00`).toLocaleDateString('bn-BD', { day: 'numeric', month: 'short', year: 'numeric' });

const statusColors: Record<string, string> = {
  Delivered: '#15966a',
  Pending: '#e5a529',
  Processing: '#5585d8',
  Cancelled: '#df675d',
  'In-Transit': '#27a9b8',
  Fake: '#9b718e',
};

const sourceColors: Record<string, string> = {
  Website: '#167b68',
  App: '#477fc8',
  Facebook: '#6189d1',
  Instagram: '#cf6f86',
  WhatsApp: '#45a878',
  Unattributed: '#a9b6b9',
};

function MetricCard({ label, value, detail, icon: Icon, tone }: {
  label: string;
  value: string;
  detail: string;
  icon: typeof ShoppingBag;
  tone: string;
}) {
  return <article className="rounded-xl border border-[#e0e8e5] bg-white p-4 shadow-[0_3px_16px_rgba(26,55,48,0.035)] sm:p-5">
    <div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold text-[#70827c]">{label}</p><p className="mt-3 break-words text-2xl font-black text-[#172d27] sm:text-[28px]">{value}</p></div><span className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-[18px]" /></span></div>
    <div className="mt-3 flex items-center gap-1.5 text-[11px] text-[#788983]"><span className="size-1.5 rounded-full bg-[#7ca390]" />{detail}</div>
  </article>;
}

function SectionHeading({ title, detail, action }: { title: string; detail?: string; action?: React.ReactNode }) {
  return <div className="mb-4 flex min-w-0 items-start justify-between gap-3"><div className="min-w-0"><h2 className="text-[15px] font-extrabold text-[#18342c]">{title}</h2>{detail && <p className="mt-1 text-xs leading-5 text-[#7a8a85]">{detail}</p>}</div>{action}</div>;
}

function buildHeatmap(data: DashboardData['activity']) {
  const byDate = new Map(data.map((day) => [day.date, day.count]));
  if (!data.length) return [];
  const lastDay = new Date(`${data[data.length - 1].date}T00:00:00Z`);
  const firstDay = new Date(`${data[0].date}T00:00:00Z`);
  firstDay.setUTCDate(firstDay.getUTCDate() - firstDay.getUTCDay());
  const dayCount = Math.floor((lastDay.getTime() - firstDay.getTime()) / 86_400_000) + 1;
  return Array.from({ length: dayCount }, (_, index) => {
    const date = new Date(firstDay.getTime() + index * 86_400_000);
    const key = date.toISOString().slice(0, 10);
    return { date: key, count: byDate.get(key) || 0 };
  });
}

function heatColor(count: number, max: number) {
  if (!count) return '#edf2ef';
  const intensity = count / Math.max(max, 1);
  if (intensity < 0.25) return '#b8e1cc';
  if (intensity < 0.5) return '#77c69c';
  if (intensity < 0.75) return '#36a875';
  return '#167c59';
}

export default function AdminDashboard() {
  const now = new Date();
  const [period, setPeriod] = useState<Period>('today');
  const [startDate, setStartDate] = useState(dateInput(now));
  const [endDate, setEndDate] = useState(dateInput(now));
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [newNotifications, setNewNotifications] = useState(0);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState('');
  const [orderName, setOrderName] = useState('');
  const [orderPhone, setOrderPhone] = useState('');
  const [orderAddress, setOrderAddress] = useState('');
  const [orderDistrict, setOrderDistrict] = useState('');
  const [orderThana, setOrderThana] = useState('');
  const [orderProductId, setOrderProductId] = useState('');
  const [orderQuantity, setOrderQuantity] = useState(1);
  const [orderSource, setOrderSource] = useState('App');
  const [orderStaff, setOrderStaff] = useState('');
  const [orderError, setOrderError] = useState('');
  const lastNotificationId = useRef('');
  const district = findBangladeshDistrict(orderDistrict);
  const upazilas = getBangladeshUpazilas(orderDistrict);
  const availableProducts = data?.inventory.products.filter((product) => product.stock > 0) || [];
  const selectedProduct = availableProducts.find((product) => product.id === orderProductId) || availableProducts[0];

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (active) setRefreshing(true);
      try {
        const response = await fetch(`/api/admin/analytics?start=${startDate}&end=${endDate}`, { cache: 'no-store' });
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'ড্যাশবোর্ডের তথ্য লোড করা যায়নি।');
        if (!active) return;
        const nextData = result.data as DashboardData;
        const latestId = nextData.notifications[0]?.id || '';
        if (lastNotificationId.current && latestId && latestId !== lastNotificationId.current) {
          const previousIndex = nextData.notifications.findIndex((item) => item.id === lastNotificationId.current);
          setNewNotifications((count) => count + (previousIndex > 0 ? previousIndex : 1));
        }
        if (latestId) lastNotificationId.current = latestId;
        setData(nextData);
        setError('');
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : 'ড্যাশবোর্ডের তথ্য লোড করা যায়নি।');
      } finally {
        if (active) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    };
    void load();
    const timer = window.setInterval(() => void load(), 30_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [startDate, endDate, refreshKey]);

  const heatmap = useMemo(() => buildHeatmap(data?.activity || []), [data?.activity]);
  const heatmapMax = Math.max(...(data?.activity.map((day) => day.count) || [0]), 1);
  const sourceMax = Math.max(...(data?.sources.map((source) => source.count) || [0]), 1);
  const regionMax = Math.max(...(data?.regions.map((region) => region.count) || [0]), 1);
  const activityMax = Math.max(...(data?.hourly.map((point) => point.count) || [0]), 1);
  const totalStatusCount = data?.statuses.reduce((sum, status) => sum + status.count, 0) || 0;
  let statusOffset = 0;
  const statusStops = data?.statuses.map((status) => {
    const start = statusOffset;
    statusOffset += totalStatusCount ? status.count / totalStatusCount * 100 : 0;
    return `${statusColors[status.label] || '#a9b6b9'} ${start}% ${statusOffset}%`;
  }) || [];
  const statusGradient = totalStatusCount ? `conic-gradient(${statusStops.join(', ')})` : 'conic-gradient(#e9efec 0% 100%)';
  const realPercent = data?.health.real ? Math.round(data.health.real / Math.max(data.health.real + data.health.fake, 1) * 100) : 0;
  const chartPoints = data?.hourly.map((point, index) => `${index / 23 * 100},${92 - point.count / activityMax * 76}`).join(' ') || '';
  const selectedRange = startDate === endDate ? dateLabel(startDate) : `${dateLabel(startDate)} – ${dateLabel(endDate)}`;

  const choosePeriod = (nextPeriod: Period) => {
    setPeriod(nextPeriod);
    const date = new Date();
    if (nextPeriod === 'yesterday') date.setDate(date.getDate() - 1);
    if (nextPeriod !== 'custom') {
      const value = dateInput(date);
      setStartDate(value);
      setEndDate(value);
    }
  };

  const createOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOrderError('');
    if (!selectedProduct) return setOrderError('একটি পণ্য নির্বাচন করুন।');
    if (!/^01[3-9]\d{8}$/.test(orderPhone)) return setOrderError('সঠিক ১১ সংখ্যার বাংলাদেশি ফোন নম্বর দিন।');
    setCreating(true);
    try {
      const fullAddress = `জেলা: ${district?.english || orderDistrict}, থানা: ${orderThana}, ঠিকানা: ${orderAddress}`;
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: orderName,
          customerPhone: orderPhone,
          district: district?.english || orderDistrict,
          thana: orderThana,
          customerAddress: fullAddress,
          shippingAddress: fullAddress,
          userEmail: 'guest@example.com',
          source: orderSource,
          assignedStaff: orderStaff,
          items: [{ productId: selectedProduct.id, name: selectedProduct.name, price: selectedProduct.price, quantity: orderQuantity, imageUrl: selectedProduct.imageUrl }],
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অর্ডার তৈরি করা যায়নি।');
      setCreateOpen(false);
      setOrderName(''); setOrderPhone(''); setOrderAddress(''); setOrderDistrict(''); setOrderThana(''); setOrderQuantity(1); setOrderStaff('');
      setToast('নতুন অর্ডার তৈরি হয়েছে');
      window.setTimeout(() => setToast(''), 2800);
      setRefreshing(true);
      setRefreshKey((key) => key + 1);
    } catch (reason) {
      setOrderError(reason instanceof Error ? reason.message : 'অর্ডার তৈরি করা যায়নি।');
    } finally {
      setCreating(false);
    }
  };

  return <div className="space-y-5 sm:space-y-6">
    <div className="flex flex-col justify-between gap-4 2xl:flex-row 2xl:items-end">
      <div className="min-w-0"><div className="flex items-center gap-2"><span className="grid size-8 place-items-center rounded-lg bg-[#dff1e8] text-[#177452]"><Activity className="size-4" /></span><p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#668078]">Store intelligence</p><span className="inline-flex items-center gap-1.5 rounded-full bg-[#eaf6ef] px-2 py-1 text-[10px] font-bold text-[#16734f]"><span className="size-1.5 animate-pulse rounded-full bg-[#20a36c]" />LIVE</span></div><h1 className="mt-2 text-2xl font-black tracking-tight text-[#17332b] sm:text-[30px]">ড্যাশবোর্ড</h1><p className="mt-1 text-sm text-[#73847e]">অর্ডার, বিক্রি এবং স্টোরের স্বাস্থ্য এক জায়গায় দেখুন।</p></div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/admin/products/manage" className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-xs font-bold transition hover:-translate-y-0.5 ${data?.inventory.lowStockCount ? 'border-[#f2d59e] bg-[#fff7e8] text-[#8c5a08]' : 'border-[#e1e9e5] bg-white text-[#62766e]'}`}><AlertTriangle className="size-4" />স্টক সতর্কতা <span className="rounded-full bg-white/80 px-1.5 py-0.5">{number(data?.inventory.lowStockCount || 0)}</span></Link>
        <span className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[#e1e9e5] bg-white px-3 text-xs font-semibold text-[#64766f]" title="SMS provider এখনো সংযুক্ত নয়"><MessageSquareText className="size-4 text-[#788d86]" />SMS <span className="text-[#a45d34]">সংযুক্ত নয়</span></span>
        <button type="button" onClick={() => setCreateOpen(true)} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#176b52] px-3.5 text-xs font-extrabold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-[#125841] active:scale-[0.98]"><Plus className="size-4" />নতুন অর্ডার</button>
        <button type="button" onClick={() => setNotificationOpen((open) => !open)} aria-label={`অর্ডার নোটিফিকেশন${newNotifications ? `, ${newNotifications}টি নতুন` : ''}`} aria-expanded={notificationOpen} className="relative grid size-10 place-items-center rounded-lg border border-[#dce7e2] bg-white text-[#557068] transition hover:bg-[#f3f8f5] hover:text-[#1b7959]"><Bell className="size-[18px]" />{newNotifications > 0 && <span className="absolute -right-1 -top-1 grid min-h-[18px] min-w-[18px] place-items-center rounded-full bg-[#d15c50] px-1 text-[9px] font-black text-white">{number(newNotifications)}</span>}</button>
      </div>
    </div>

    <div className="flex flex-col justify-between gap-3 rounded-xl border border-[#dce8e3] bg-white p-3.5 sm:flex-row sm:items-center sm:px-4">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="তারিখের সীমা">
        {([['today', 'আজ'], ['yesterday', 'গতকাল'], ['custom', 'কাস্টম রেঞ্জ']] as [Period, string][]).map(([key, label]) => <button key={key} type="button" onClick={() => choosePeriod(key)} aria-pressed={period === key} className={`min-h-9 rounded-md px-3 text-xs font-bold transition ${period === key ? 'bg-[#173c31] text-white shadow-sm' : 'text-[#71827c] hover:bg-[#f1f6f3] hover:text-[#1f4d3d]'}`}>{label}</button>)}
        {period === 'custom' && <div className="ml-1 flex flex-wrap items-center gap-2"><label className="sr-only" htmlFor="range-start">শুরুর তারিখ</label><input id="range-start" type="date" value={startDate} max={endDate} onChange={(event) => setStartDate(event.target.value)} className="h-9 rounded-md border border-[#dce5e1] px-2 text-xs text-[#30463e]" /><span className="text-xs text-[#9aa9a3]">থেকে</span><label className="sr-only" htmlFor="range-end">শেষের তারিখ</label><input id="range-end" type="date" value={endDate} min={startDate} onChange={(event) => setEndDate(event.target.value)} className="h-9 rounded-md border border-[#dce5e1] px-2 text-xs text-[#30463e]" /></div>}
      </div>
      <div className="flex items-center justify-between gap-3 sm:justify-end"><span className="text-xs font-semibold text-[#778780]">{selectedRange}</span><button type="button" onClick={() => { setRefreshing(true); setRefreshKey((key) => key + 1); }} disabled={refreshing} aria-label="ড্যাশবোর্ড রিফ্রেশ করুন" title="রিফ্রেশ" className="grid size-9 place-items-center rounded-md border border-[#e1e9e5] text-[#61766e] transition hover:bg-[#f3f8f5] disabled:opacity-50"><RefreshCw className={`size-4 ${refreshing ? 'animate-spin' : ''}`} /></button></div>
    </div>

    {error && <div role="alert" className="flex items-start gap-2 rounded-lg border border-[#f0c7bf] bg-[#fff3f0] px-4 py-3 text-sm text-[#8e3c30]"><AlertTriangle className="mt-0.5 size-4 shrink-0" />{error}</div>}

    <section aria-label="মূল ব্যবসায়িক সূচক" className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">
      <MetricCard label="মোট অর্ডার" value={loading ? '—' : number(data?.period.totalOrders || 0)} detail={`${selectedRange} · সব স্ট্যাটাস`} icon={ShoppingBag} tone="bg-[#e8f2ff] text-[#467ab5]" />
      <MetricCard label="মোট বিক্রি" value={loading ? '—' : money(data?.period.totalRevenue || 0)} detail="এই সময়ের অর্ডার ভ্যালু" icon={CircleDollarSign} tone="bg-[#e6f5ed] text-[#18805a]" />
      <MetricCard label="আইটেম বিক্রি" value={loading ? '—' : number(data?.period.totalItems || 0)} detail="অর্ডার লাইনের মোট পরিমাণ" icon={ShoppingCart} tone="bg-[#fff2df] text-[#bd7b1a]" />
      <MetricCard label="মোট কাস্টমার" value={loading ? '—' : number(data?.period.totalCustomers || 0)} detail="ফোন/নাম অনুযায়ী ইউনিক" icon={Users} tone="bg-[#fbe9eb] text-[#bf5f6c]" />
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.05fr_1fr_0.9fr]">
      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="অর্ডার স্ট্যাটাস" detail="নির্বাচিত সময়ের অর্ডার" />
        <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center">
          <div role="img" aria-label="অর্ডারের স্ট্যাটাস অনুযায়ী বণ্টন" className="relative grid size-44 shrink-0 place-items-center rounded-full" style={{ background: statusGradient }}><div className="grid size-[116px] place-content-center rounded-full bg-white text-center shadow-inner"><strong className="text-2xl font-black text-[#203a32]">{number(totalStatusCount)}</strong><span className="mt-0.5 text-[10px] font-semibold text-[#81918b]">মোট অর্ডার</span></div></div>
          <div className="grid w-full grid-cols-2 gap-x-4 gap-y-3 sm:w-auto sm:grid-cols-1">{(data?.statuses || []).map((status) => <div key={status.label} className="flex min-w-0 items-center gap-2 text-xs"><span className="size-2.5 shrink-0 rounded-sm" style={{ backgroundColor: statusColors[status.label] }} /><span className="min-w-0 flex-1 text-[#667a72]">{status.label}</span><strong className="font-extrabold text-[#243b33]">{number(status.count)}</strong></div>)}</div>
        </div>
      </article>

      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="অর্ডারের উৎস" detail="চ্যানেল অনুযায়ী অর্ডার" />
        <div className="space-y-4">{(data?.sources || []).map((source) => <div key={source.label}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="font-semibold text-[#64776f]">{source.label === 'Unattributed' ? 'অজানা উৎস' : source.label}</span><strong className="text-[#2d433b]">{number(source.count)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#eff3f1]"><div className="h-full rounded-full transition-[width] duration-700" style={{ width: `${source.count / sourceMax * 100}%`, backgroundColor: sourceColors[source.label] || '#a9b6b9' }} /></div></div>)}</div>
        <p className="mt-4 border-t border-[#edf1ef] pt-3 text-[10px] leading-4 text-[#84938d]">পুরোনো অর্ডারে উৎস সংরক্ষিত না থাকলে “অজানা উৎস” হিসেবে দেখানো হয়।</p>
      </article>

      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="অর্ডার হেলথ" detail="স্পষ্টভাবে ফ্ল্যাগ করা জাল অর্ডার" />
        <div className="flex flex-col items-center justify-center gap-4 py-1"><div role="img" aria-label={`বাস্তব অর্ডার ${realPercent} শতাংশ`} className="grid size-36 place-items-center rounded-full" style={{ background: `conic-gradient(#16815d ${realPercent}%, #f0b6ae 0)` }}><div className="grid size-28 place-content-center rounded-full bg-white text-center"><strong className="text-3xl font-black text-[#17573f]">{number(realPercent)}%</strong><span className="text-[10px] font-semibold text-[#809089]">বাস্তব অর্ডার</span></div></div><div className="flex w-full justify-center gap-5 text-xs"><span className="inline-flex items-center gap-1.5 text-[#60756c]"><i className="size-2 rounded-full bg-[#16815d]" />বাস্তব <strong className="text-[#203c32]">{number(data?.health.real || 0)}</strong></span><span className="inline-flex items-center gap-1.5 text-[#60756c]"><i className="size-2 rounded-full bg-[#e27c70]" />জাল <strong className="text-[#203c32]">{number(data?.health.fake || 0)}</strong></span></div></div>
      </article>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="ঘণ্টাভিত্তিক অর্ডার" detail="দিনের ২৪ ঘণ্টায় অর্ডারের বণ্টন" action={<Clock3 className="size-4 text-[#8b9b95]" />} />
        <div className="relative h-48 w-full sm:h-56"><div className="pointer-events-none absolute inset-0 flex flex-col justify-between">{[0, 1, 2, 3].map((tick) => <div key={tick} className="flex items-center gap-2"><span className="w-5 text-right text-[9px] text-[#9aa9a3]">{number(Math.round(activityMax * (3 - tick) / 3))}</span><span className="h-px flex-1 border-t border-dashed border-[#e6eeea]" /></div>)}</div><svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" aria-label="প্রতি ঘণ্টার অর্ডারের লাইন চার্ট" className="absolute inset-0 h-full w-[calc(100%-28px)] translate-x-7 overflow-visible"><defs><linearGradient id="hour-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#36a77d" stopOpacity=".23" /><stop offset="100%" stopColor="#36a77d" stopOpacity="0" /></linearGradient></defs><polygon points={`0,100 ${chartPoints} 100,100`} fill="url(#hour-fill)" /><polyline points={chartPoints} fill="none" stroke="#16805f" strokeWidth="1.7" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />{(data?.hourly || []).filter((point) => point.count > 0).map((point) => <circle key={point.hour} cx={point.hour / 23 * 100} cy={92 - point.count / activityMax * 76} r="1.4" fill="#fff" stroke="#16805f" strokeWidth="1.2" vectorEffect="non-scaling-stroke"><title>{String(point.hour).padStart(2, '0')}:00 · {number(point.count)} অর্ডার</title></circle>)}</svg><div className="absolute bottom-0 left-7 right-0 flex justify-between text-[9px] text-[#899992]">{[0, 6, 12, 18, 23].map((hour) => <span key={hour}>{String(hour).padStart(2, '0')}:00</span>)}</div></div>
      </article>
      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="শীর্ষ অর্ডার এরিয়া" detail="জেলা অনুযায়ী অর্ডার সংখ্যা" />
        {data?.regions.length ? <div className="space-y-3.5">{data.regions.map((region, index) => <div key={region.name}><div className="mb-1.5 flex items-center justify-between gap-3 text-xs"><span className="truncate font-semibold text-[#566d64]">{region.name}</span><strong className="text-[#274338]">{number(region.count)}</strong></div><div className="h-2 overflow-hidden rounded-full bg-[#edf2ef]"><div className="h-full rounded-full" style={{ width: `${region.count / regionMax * 100}%`, backgroundColor: ['#17815f', '#498cbe', '#d9983e', '#cf6e77', '#59a892', '#8a7ab4'][index % 6] }} /></div></div>)}</div> : <EmptyMessage>এই সময়ের অর্ডারে এলাকার তথ্য নেই।</EmptyMessage>}
      </article>
    </section>

    <section className="rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><SectionHeading title="৩৬৫ দিনের অর্ডার অ্যাক্টিভিটি" detail="প্রতিদিনের অর্ডার ভলিউম" /><div className="flex items-center gap-1.5 text-[10px] text-[#81918b]">কম <span className="size-3 rounded-[3px] bg-[#edf2ef]" /><span className="size-3 rounded-[3px] bg-[#b8e1cc]" /><span className="size-3 rounded-[3px] bg-[#77c69c]" /><span className="size-3 rounded-[3px] bg-[#36a875]" /><span className="size-3 rounded-[3px] bg-[#167c59]" /> বেশি</div></div>
      <div className="overflow-x-auto pb-2"><div className="grid w-max grid-flow-col grid-rows-7 gap-1" aria-label="গত ৩৬৫ দিনের অর্ডার হিটম্যাপ">{heatmap.map((cell) => <span key={cell.date} title={`${dateLabel(cell.date)} · ${number(cell.count)} অর্ডার`} aria-label={`${cell.date}: ${cell.count} অর্ডার`} className="size-[11px] rounded-[3px] ring-1 ring-black/[0.025] sm:size-3" style={{ backgroundColor: heatColor(cell.count, heatmapMax) }} />)}</div></div>
      <p className="mt-2 flex items-center gap-1.5 text-[10px] text-[#8a9993]"><CalendarDays className="size-3.5" />প্রতিটি ঘর এক দিন · সর্বোচ্চ {number(heatmapMax)} অর্ডার</p>
    </section>

    <section className="grid gap-4 xl:grid-cols-[1fr_0.85fr]">
      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="টপ সেলিং পণ্য" detail="বিক্রীত ইউনিট অনুযায়ী" action={<Link href="/admin/products" className="text-xs font-bold text-[#176f52] hover:underline">সব পণ্য <ChevronDown className="inline size-3.5 -rotate-90" /></Link>} />
        {data?.topProducts.length ? <div className="divide-y divide-[#edf1ef]">{data.topProducts.map((product, index) => <div key={`${product.id}-${index}`} className="flex items-center gap-3 py-3 first:pt-1 last:pb-0"><span className="grid size-6 shrink-0 place-items-center rounded-md bg-[#f2f6f4] text-[10px] font-extrabold text-[#71847b]">{String(index + 1).padStart(2, '0')}</span><div className="size-11 shrink-0 overflow-hidden rounded-lg bg-[#f2f5f3]">{normalizeImageUrl(product.imageUrl) && <img src={normalizeImageUrl(product.imageUrl)} alt="" className="size-full object-cover" />}</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-[#2d443a]">{product.name}</p><p className="mt-1 text-[10px] text-[#82918b]">{number(product.quantity)} ইউনিট বিক্রি</p></div><div className="text-right"><strong className="text-xs text-[#285443]">{money(product.revenue)}</strong><span className="mt-1 block text-[10px] text-[#86958f]">{money(product.revenue / Math.max(product.quantity, 1))} / ইউনিট</span></div></div>)}</div> : <EmptyMessage>এই সময়ের মধ্যে বিক্রির পণ্য নেই।</EmptyMessage>}
      </article>
      <article className="min-w-0 rounded-xl border border-[#e0e8e5] bg-white p-4 sm:p-5">
        <SectionHeading title="কর্মী পারফরম্যান্স" detail="ম্যানেজ করা অর্ডার · স্ট্যাটাস অনুযায়ী" />
        <div className="overflow-x-auto"><table className="w-full min-w-[500px] text-left text-xs"><thead><tr className="border-b border-[#e8eeeb] text-[10px] font-bold text-[#81918b]"><th className="py-2.5 pr-3">কর্মী</th><th className="px-2 py-2.5 text-right">Pending</th><th className="px-2 py-2.5 text-right">Confirmed</th><th className="px-2 py-2.5 text-right">Delivered</th><th className="px-2 py-2.5 text-right">Cancelled</th></tr></thead><tbody className="divide-y divide-[#edf1ef]">{data?.employees.length ? data.employees.map((employee) => <tr key={employee.name}><td className="py-3 pr-3 font-bold text-[#40574e]">{employee.name}</td><td className="px-2 py-3 text-right font-semibold text-[#bb8121]">{number(employee.Pending)}</td><td className="px-2 py-3 text-right font-semibold text-[#4b7bc0]">{number(employee.Confirmed)}</td><td className="px-2 py-3 text-right font-semibold text-[#18835d]">{number(employee.Delivered)}</td><td className="px-2 py-3 text-right font-semibold text-[#cb665d]">{number(employee.Cancelled)}</td></tr>) : <tr><td colSpan={5} className="py-8 text-center text-xs text-[#82918b]">এই সময়ের অর্ডারে কোনো কর্মী অ্যাসাইন নেই।</td></tr>}</tbody></table></div>
        <p className="mt-3 border-t border-[#edf1ef] pt-3 text-[10px] leading-4 text-[#899892]">কর্মী অ্যাসাইন না থাকলে অর্ডারগুলো “Unassigned” হিসেবে দেখানো হয়।</p>
      </article>
    </section>

    {notificationOpen && <div className="fixed inset-0 z-40 bg-black/10 sm:bg-transparent" onMouseDown={(event) => { if (event.target === event.currentTarget) setNotificationOpen(false); }}><section role="dialog" aria-modal="true" aria-label="সাম্প্রতিক অর্ডার নোটিফিকেশন" className="fixed inset-x-3 top-20 z-50 mx-auto max-h-[70vh] w-auto overflow-y-auto rounded-xl border border-[#dce7e2] bg-white p-4 shadow-2xl sm:inset-x-auto sm:right-7 sm:top-20 sm:w-[360px]"><div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-extrabold text-[#244137]">সাম্প্রতিক অর্ডার</h2><p className="mt-1 text-[10px] text-[#82918b]">প্রতি ৩০ সেকেন্ডে আপডেট</p></div><button type="button" onClick={() => { setNotificationOpen(false); setNewNotifications(0); }} aria-label="নোটিফিকেশন বন্ধ করুন" className="grid size-8 place-items-center rounded-md text-[#7c8b85] hover:bg-[#f2f6f4]"><X className="size-4" /></button></div>{data?.notifications.length ? <div className="divide-y divide-[#edf1ef]">{data.notifications.map((item) => <Link key={item.id} href="/admin/orders" onClick={() => setNotificationOpen(false)} className="flex items-center justify-between gap-3 py-3"><span className="min-w-0"><strong className="block truncate text-xs text-[#344b41]">{item.customerName}</strong><small className="mt-1 block text-[10px] text-[#879690]">{new Date(item.createdAt).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })} · {item.status}</small></span><strong className="whitespace-nowrap text-xs text-[#176f52]">{money(item.totalAmount)}</strong></Link>)}</div> : <EmptyMessage>এখনো কোনো অর্ডার নেই।</EmptyMessage>}<Link href="/admin/orders" onClick={() => setNotificationOpen(false)} className="mt-2 inline-flex min-h-9 w-full items-center justify-center rounded-md bg-[#f0f6f3] text-xs font-bold text-[#1c694e]">সব অর্ডার দেখুন</Link></section></div>}

    {createOpen && <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[#122a24]/55 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" onMouseDown={(event) => { if (event.target === event.currentTarget) setCreateOpen(false); }}><section role="dialog" aria-modal="true" aria-labelledby="create-order-title" className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#1a7957]">Quick action</p><h2 id="create-order-title" className="mt-1 text-xl font-black text-[#19372d]">নতুন অর্ডার তৈরি</h2></div><button type="button" onClick={() => setCreateOpen(false)} aria-label="অর্ডার ফর্ম বন্ধ করুন" className="grid size-9 place-items-center rounded-lg border border-[#e2e9e6] text-[#70827a] hover:bg-[#f3f7f5]"><X className="size-4" /></button></div><form onSubmit={createOrder} className="grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-[#5e7269]">কাস্টমারের নাম *<input required value={orderName} onChange={(event) => setOrderName(event.target.value)} autoComplete="name" className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] px-3 text-sm font-normal text-[#233c32] outline-none focus:border-[#287d60]" /></label>
      <label className="text-xs font-bold text-[#5e7269]">মোবাইল নম্বর *<input required type="tel" inputMode="numeric" pattern="01[3-9][0-9]{8}" maxLength={11} value={orderPhone} onChange={(event) => setOrderPhone(event.target.value.replace(/\D/g, '').slice(0, 11))} autoComplete="tel" placeholder="01XXXXXXXXX" className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] px-3 text-sm font-normal text-[#233c32] outline-none focus:border-[#287d60]" /></label>
      <label className="text-xs font-bold text-[#5e7269]">অর্ডারের উৎস<select value={orderSource} onChange={(event) => setOrderSource(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] bg-white px-3 text-sm font-normal text-[#233c32]"><option>App</option><option>Website</option><option>Facebook</option><option>Instagram</option><option>WhatsApp</option></select></label>
      <label className="text-xs font-bold text-[#5e7269]">দায়িত্বপ্রাপ্ত কর্মী<input value={orderStaff} onChange={(event) => setOrderStaff(event.target.value)} maxLength={60} placeholder="ঐচ্ছিক" className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] px-3 text-sm font-normal text-[#233c32]" /></label>
      <label className="text-xs font-bold text-[#5e7269]">পণ্য<select required value={orderProductId || availableProducts[0]?.id || ''} onChange={(event) => setOrderProductId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] bg-white px-3 text-sm font-normal text-[#233c32]"><option value="" disabled>পণ্য নির্বাচন করুন</option>{availableProducts.map((product) => <option key={product.id} value={product.id}>{product.name} · {money(product.price)}</option>)}</select></label>
      <label className="text-xs font-bold text-[#5e7269]">জেলা *<SearchableDistrictSelect required value={district?.english || ''} onChange={(value) => { setOrderDistrict(value); setOrderThana(''); }} className="mt-1.5 rounded-md" /></label>
      <label className="text-xs font-bold text-[#5e7269]">থানা *<select required disabled={!district} value={upazilas.find((item) => item.english === orderThana || item.bangla === orderThana)?.english || ''} onChange={(event) => setOrderThana(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] bg-white px-3 text-sm font-normal text-[#233c32] disabled:opacity-50"><option value="" disabled>থানা বাছুন</option>{upazilas.map((item) => <option key={item.id} value={item.english}>{item.bangla}</option>)}</select></label>
      <label className="text-xs font-bold text-[#5e7269]">পরিমাণ *<input required type="number" min={1} max={selectedProduct?.stock || 1} value={orderQuantity} onChange={(event) => setOrderQuantity(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-[#dce5e1] px-3 text-sm font-normal text-[#233c32]" /></label>
      <label className="text-xs font-bold text-[#5e7269] sm:col-span-2">সম্পূর্ণ ঠিকানা *<textarea required rows={2} value={orderAddress} onChange={(event) => setOrderAddress(event.target.value)} className="mt-1.5 w-full rounded-md border border-[#dce5e1] px-3 py-2 text-sm font-normal text-[#233c32] outline-none focus:border-[#287d60]" /></label>
      {selectedProduct && <p className="flex items-center justify-between rounded-lg bg-[#f3f7f5] px-3 py-2 text-xs text-[#64776e] sm:col-span-2"><span>{number(orderQuantity)} × {money(selectedProduct.price)}</span><strong className="text-sm text-[#1a674d]">পণ্য মোট {money(selectedProduct.price * orderQuantity)} + ডেলিভারি</strong></p>}
      {orderError && <p role="alert" className="rounded-md border border-[#f0c7bf] bg-[#fff3f0] px-3 py-2 text-xs text-[#8e3c30] sm:col-span-2">{orderError}</p>}
      <button type="submit" disabled={creating || !selectedProduct} className="mt-1 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#176b52] px-4 text-sm font-extrabold text-white transition hover:bg-[#125841] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:col-span-2">{creating ? <LoaderCircle className="size-4 animate-spin" /> : <Check className="size-4" />}{creating ? 'অর্ডার তৈরি হচ্ছে...' : 'অর্ডার তৈরি করুন'}</button>
      </form></section></div>}

    {toast && <p role="status" className="fixed bottom-5 right-5 z-[70] inline-flex items-center gap-2 rounded-lg bg-[#145d47] px-4 py-3 text-sm font-bold text-white shadow-lg"><Check className="size-4" />{toast}</p>}
  </div>;
}

function EmptyMessage({ children }: { children: React.ReactNode }) {
  return <p className="py-8 text-center text-xs text-[#84938d]">{children}</p>;
}