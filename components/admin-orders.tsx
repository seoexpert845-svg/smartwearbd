'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, LoaderCircle, Phone, Printer, Search, Send, X } from 'lucide-react';
import { getCustomerName, getCustomerPhone, getOrderShippingDetails } from '@/lib/order-format';
import { normalizeImageUrl } from '@/lib/image-url';
import AdminOrderDetails from '@/components/admin-order-details';
import OrderBarcode from '@/components/order-barcode';

type OrderItem = { productId?: string; name?: string; price?: number; quantity?: number; imageUrl?: string; variant?: string; size?: string };
type Order = {
  _id: string;
  customerName?: string;
  name?: string;
  customerPhone?: string;
  phone?: string;
  customerAddress?: string;
  address?: string;
  shippingAddress?: string;
  district?: string;
  thana?: string;
  userEmail?: string;
  email?: string;
  items?: OrderItem[];
  courierName?: string;
  courierStatus?: string;
  trackingId?: string;
  totalAmount?: number;
  shippingFee?: number;
  discountAmount?: number;
  discountType?: 'flat' | 'percentage';
  discountValue?: number;
  taxAmount?: number;
  paymentMethod?: string;
  source?: string;
  assignedStaff?: string;
  customerIp?: string;
  isFake?: boolean;
  advancePayment?: { amount?: number; gateway?: string; transactionId?: string; receivedBy?: string; receivedAt?: string };
  fraudCheck?: { totalOrders?: number; delivered?: number; returned?: number; cancelled?: number; successRate?: number; returnRate?: number; cancellationRate?: number; provider?: string; checkedAt?: string };
  activityLog?: { action: string; actor: string; details?: string; createdAt: string }[];
  isAbandonedCart?: boolean;
  cartSessionId?: string;
  status: string;
  createdAt: string;
};
type Product = { _id: string; name: string; price: number; imageUrl?: string; images?: string[]; stock?: number };
type Range = 'lifetime' | 'today' | 'yesterday' | '7d' | 'month' | 'last-month' | 'custom';
type BulkAction = 'status' | 'assignStaff' | 'assignCourier' | 'dispatchCourier' | 'fake' | 'sms' | 'printInvoice' | 'printLabel';

const orderStatuses = ['New', 'Incomplete', 'Pending Response', 'No Response', 'Fake', 'Advance Payment', 'Confirmed', 'On Hold', 'Processing', 'Ready For Pickup', 'Pending (Courier)', 'In Transit', 'Delivered', 'Partial Delivered', 'Returned', 'Cancelled', 'Lost', 'Pending', 'Shipped'];
const tabs = ['All', 'New', 'Incomplete', 'Pending Response', 'No Response', 'Fake', 'Advance Payment', 'Confirmed', 'On Hold', 'Processing', 'Ready For Pickup', 'Pending (Courier)', 'In Transit', 'Delivered', 'Partial Delivered', 'Returned', 'Cancelled', 'Lost'];
const sources = ['Website', 'Landing Page', 'Direct Order', 'App', 'WhatsApp', 'Facebook', 'Instagram', 'TikTok', 'Google'];
const couriers = ['Steadfast', 'Pathao', 'RedX', 'Carrybee'];
const money = (amount: number) => `৳${new Intl.NumberFormat('bn-BD').format(Number(amount || 0))}`;
const dayStart = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function matchesTab(order: Order, tab: string) {
  if (tab === 'All') return true;
  if (tab === 'Fake') return order.isFake === true || order.status === 'Fake';
  if (tab === 'Advance Payment') return Number(order.advancePayment?.amount || 0) > 0 || order.status === tab;
  if (tab === 'New') return order.status === 'New' || (order.status === 'Pending' && Date.now() - new Date(order.createdAt).getTime() < 24 * 60 * 60 * 1000);
  return order.status === tab;
}

function matchesRange(order: Order, range: Range, customStart: string, customEnd: string) {
  if (range === 'lifetime') return true;
  const created = new Date(order.createdAt);
  const stamp = dayStart(created);
  const today = dayStart(new Date());
  if (range === 'today') return stamp === today;
  if (range === 'yesterday') return stamp === today - 86_400_000;
  if (range === '7d') return stamp >= today - 6 * 86_400_000 && stamp <= today;
  if (range === 'month') return created.getFullYear() === new Date().getFullYear() && created.getMonth() === new Date().getMonth();
  if (range === 'last-month') {
    const lastMonth = new Date(); lastMonth.setDate(1); lastMonth.setMonth(lastMonth.getMonth() - 1);
    return created.getFullYear() === lastMonth.getFullYear() && created.getMonth() === lastMonth.getMonth();
  }
  const start = customStart ? dayStart(new Date(`${customStart}T00:00:00`)) : 0;
  const end = customEnd ? dayStart(new Date(`${customEnd}T00:00:00`)) + 86_400_000 : Number.MAX_SAFE_INTEGER;
  return stamp >= start && stamp < end;
}

const statusStyle: Record<string, string> = {
  New: 'bg-sky-50 text-sky-800', Incomplete: 'bg-stone-100 text-stone-700', 'Pending Response': 'bg-amber-50 text-amber-800',
  'No Response': 'bg-orange-50 text-orange-800', Fake: 'bg-rose-50 text-rose-800', 'Advance Payment': 'bg-cyan-50 text-cyan-800',
  Confirmed: 'bg-blue-50 text-blue-800', 'On Hold': 'bg-yellow-50 text-yellow-900', Processing: 'bg-violet-50 text-violet-800',
  'Ready For Pickup': 'bg-indigo-50 text-indigo-800', 'Pending (Courier)': 'bg-slate-100 text-slate-700', 'In Transit': 'bg-teal-50 text-teal-800',
  Delivered: 'bg-emerald-50 text-emerald-800', 'Partial Delivered': 'bg-lime-50 text-lime-800', Returned: 'bg-orange-50 text-orange-800',
  Cancelled: 'bg-rose-50 text-rose-800', Lost: 'bg-red-100 text-red-900', Pending: 'bg-amber-50 text-amber-800', Shipped: 'bg-indigo-50 text-indigo-800',
};

export default function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [updateError, setUpdateError] = useState('');
  const [savingId, setSavingId] = useState('');
  const [toast, setToast] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [activeTab, setActiveTab] = useState('All');
  const [search, setSearch] = useState('');
  const [employeeFilter, setEmployeeFilter] = useState('all');
  const [productFilter, setProductFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [courierFilter, setCourierFilter] = useState('all');
  const [range, setRange] = useState<Range>('lifetime');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>('status');
  const [bulkValue, setBulkValue] = useState('Confirmed');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [detailId, setDetailId] = useState('');
  const [printMode, setPrintMode] = useState<'invoice' | 'label' | ''>('');
  const selectedOrder = orders.find((order) => order._id === detailId);

  const reload = async () => {
    const [response, draftResponse] = await Promise.all([fetch('/api/orders', { cache: 'no-store' }), fetch('/api/abandoned-carts', { cache: 'no-store' })]);
    const [result, drafts] = await Promise.all([response.json(), draftResponse.json()]);
    if (!response.ok || !result.success) throw new Error(result.error || 'অর্ডার লোড করা যায়নি।');
    setOrders([...result.data, ...(draftResponse.ok && drafts.success ? drafts.data : [])]);
  };

  useEffect(() => {
    let active = true;
    Promise.all([fetch('/api/orders'), fetch('/api/products'), fetch('/api/abandoned-carts')])
      .then(async ([ordersResponse, productsResponse, draftsResponse]) => {
        const [orderResult, productResult, draftsResult] = await Promise.all([ordersResponse.json(), productsResponse.json(), draftsResponse.json()]);
        if (!ordersResponse.ok || !orderResult.success) throw new Error(orderResult.error || 'অর্ডার লোড করা যায়নি।');
        if (active) {
          setOrders([...orderResult.data, ...(draftsResponse.ok && draftsResult.success ? draftsResult.data : [])]);
          setProducts(productsResponse.ok && productResult.success ? productResult.data : []);
        }
      })
      .catch((error) => { if (active) setLoadError(error instanceof Error ? error.message : 'অর্ডার লোড করা যায়নি।'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    const timer = window.setInterval(async () => {
      try {
        const [ordersResponse, draftsResponse] = await Promise.all([fetch('/api/orders', { cache: 'no-store' }), fetch('/api/abandoned-carts', { cache: 'no-store' })]);
        const [orderResult, draftResult] = await Promise.all([ordersResponse.json(), draftsResponse.json()]);
        if (active && ordersResponse.ok && orderResult.success) setOrders([...orderResult.data, ...(draftsResponse.ok && draftResult.success ? draftResult.data : [])]);
      } catch { /* Keep the current list when a background refresh fails. */ }
    }, 20_000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);

  const employeeOptions = [...new Set(orders.map((order) => order.assignedStaff?.trim()).filter(Boolean))] as string[];
  const visibleOrders = useMemo(() => {
    const term = search.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchSearch = !term || [order._id, order._id.slice(-8), getCustomerName(order), getCustomerPhone(order)].some((value) => String(value || '').toLocaleLowerCase().includes(term));
      const matchEmployee = employeeFilter === 'all' || (employeeFilter === 'unassigned' ? !order.assignedStaff?.trim() : order.assignedStaff === employeeFilter);
      const matchProduct = productFilter === 'all' || order.items?.some((item) => item.productId === productFilter || item.name === products.find((product) => product._id === productFilter)?.name);
      const matchSource = sourceFilter === 'all' || order.source === sourceFilter;
      const matchCourier = courierFilter === 'all' || order.courierName === courierFilter;
      return matchesTab(order, activeTab) && matchSearch && matchEmployee && matchProduct && matchSource && matchCourier && matchesRange(order, range, customStart, customEnd);
    });
  }, [orders, products, search, employeeFilter, productFilter, sourceFilter, courierFilter, activeTab, range, customStart, customEnd]);

  const tabCount = (tab: string) => orders.filter((order) => matchesTab(order, tab)).length;
  const selectableOrders = visibleOrders.filter((order) => !order.isAbandonedCart);
  const allVisibleSelected = selectableOrders.length > 0 && selectableOrders.every((order) => selectedIds.includes(order._id));
  const selectVisible = () => setSelectedIds((current) => allVisibleSelected ? current.filter((id) => !selectableOrders.some((order) => order._id === id)) : [...new Set([...current, ...selectableOrders.map((order) => order._id)])]);

  const updateOrder = async (orderId: string, update: Record<string, unknown>) => {
    setSavingId(orderId); setUpdateError('');
    try {
      const response = await fetch(`/api/orders/${orderId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(update) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'অর্ডার আপডেট করা যায়নি।');
      setOrders((current) => current.map((order) => order._id === orderId ? result.data : order));
    } finally { setSavingId(''); }
  };

  const handleStatusChange = async (orderId: string, status: string) => {
    if (orders.find((order) => order._id === orderId)?.isAbandonedCart) {
      setUpdateError('Incomplete draft-কে আগে পূর্ণ অর্ডারে রূপান্তর করুন।');
      return;
    }
    try { await updateOrder(orderId, { status }); }
    catch (error) { setUpdateError(error instanceof Error ? error.message : 'স্ট্যাটাস আপডেট করা যায়নি।'); }
  };

  const runBulk = async () => {
    const actionableIds = selectedIds.filter((id) => !orders.find((order) => order._id === id)?.isAbandonedCart);
    if (!actionableIds.length) return;
    if (bulkAction === 'printInvoice' || bulkAction === 'printLabel') {
      setPrintMode(bulkAction === 'printInvoice' ? 'invoice' : 'label');
      window.setTimeout(() => window.print(), 100);
      return;
    }
    setBulkBusy(true); setUpdateError('');
    try {
      const body = bulkAction === 'sms'
        ? { action: 'sms', orderIds: actionableIds, message: bulkMessage }
        : { action: bulkAction, orderIds: actionableIds, value: bulkValue };
      const response = await fetch('/api/orders/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Bulk action করা যায়নি।');
      if (Array.isArray(result.data)) setOrders((current) => current.map((order) => result.data.find((updated: Order) => updated._id === order._id) || order));
      else await reload();
      setSelectedIds([]);
      setToast(`${result.updated || selectedIds.length}টি অর্ডারে action সম্পন্ন`);
      window.setTimeout(() => setToast(''), 2800);
    } catch (error) { setUpdateError(error instanceof Error ? error.message : 'Bulk action করা যায়নি।'); }
    finally { setBulkBusy(false); }
  };

  const copyOrderDetails = async (order: Order) => {
    const details = [getCustomerName(order), getCustomerPhone(order), getOrderShippingDetails(order).address].filter(Boolean).join(' · ');
    try {
      await navigator.clipboard.writeText(details);
      setCopiedId(order._id); setToast('তথ্য কপি হয়েছে');
      window.setTimeout(() => setCopiedId(''), 1600); window.setTimeout(() => setToast(''), 2200);
    } catch { setUpdateError('ক্লিপবোর্ডে কপি করা যায়নি।'); }
  };

  const detailIndex = visibleOrders.findIndex((order) => order._id === detailId);
  const printOrders = orders.filter((order) => selectedIds.includes(order._id) && !order.isAbandonedCart);

  return <div className="admin-orders space-y-4">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#176b52]">Fulfillment workspace</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">অর্ডার ম্যানেজমেন্ট</h1><p className="mt-1 text-sm text-stone-500">অর্ডার খুঁজুন, যাচাই করুন, অ্যাসাইন করুন ও fulfilment পরিচালনা করুন।</p></div><div className="flex items-center gap-2"><span className="rounded-md border border-stone-200 bg-white px-3 py-2 text-sm font-bold">{new Intl.NumberFormat('bn-BD').format(visibleOrders.length)} / {new Intl.NumberFormat('bn-BD').format(orders.length)}</span><button type="button" onClick={() => void reload().catch((error) => setUpdateError(error.message))} className="min-h-10 rounded-md border border-stone-200 bg-white px-3 text-xs font-bold hover:bg-stone-50">রিফ্রেশ</button></div></header>
    {loadError && <p role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800">{loadError}</p>}{updateError && <p role="alert" className="flex items-center justify-between gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"><span>{updateError}</span><button type="button" onClick={() => setUpdateError('')} aria-label="বার্তা বন্ধ করুন"><X className="size-4" /></button></p>}

    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm"><div className="flex min-w-max gap-1.5 p-2.5" role="tablist" aria-label="অর্ডার স্ট্যাটাস ফিল্টার">{tabs.map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} onClick={() => setActiveTab(tab)} className={`inline-flex min-h-10 items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition-all duration-200 active:scale-[0.97] ${activeTab === tab ? 'border-[#173c31] bg-[#173c31] text-white shadow-md shadow-[#173c31]/20 ring-2 ring-[#173c31]/10' : 'border-transparent bg-stone-50/70 text-stone-600 hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50 hover:text-[#14533d] hover:shadow-sm'}`}>{tab === 'All' ? 'সব' : tab}<span className={`rounded-full px-1.5 py-0.5 text-[10px] transition-colors ${activeTab === tab ? 'bg-white/15 text-white/80' : 'bg-stone-100 text-stone-400 group-hover:bg-emerald-100'}`}>{new Intl.NumberFormat('bn-BD').format(tabCount(tab))}</span></button>)}</div></div>

    <section className="rounded-lg border border-stone-200 bg-white p-3 sm:p-4"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-[minmax(190px,1.5fr)_repeat(5,minmax(130px,1fr))]"><label className="relative"><span className="sr-only">অর্ডার, নাম বা ফোন খুঁজুন</span><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-stone-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Order ID, নাম, ফোন" className="h-10 w-full rounded-md border border-stone-200 pl-9 pr-3 text-sm" /></label><select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} aria-label="কর্মী ফিল্টার" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="all">সব কর্মী</option><option value="unassigned">Unassigned</option>{employeeOptions.map((name) => <option key={name}>{name}</option>)}</select><select value={productFilter} onChange={(event) => setProductFilter(event.target.value)} aria-label="পণ্য ফিল্টার" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="all">সব পণ্য</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name}</option>)}</select><select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)} aria-label="উৎস ফিল্টার" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="all">সব উৎস</option>{sources.map((source) => <option key={source}>{source}</option>)}</select><select value={courierFilter} onChange={(event) => setCourierFilter(event.target.value)} aria-label="কুরিয়ার ফিল্টার" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="all">সব courier</option>{couriers.map((name) => <option key={name}>{name}</option>)}</select><select value={range} onChange={(event) => setRange(event.target.value as Range)} aria-label="তারিখসীমা" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="lifetime">Lifetime</option><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="7d">Last 7 days</option><option value="month">This month</option><option value="last-month">Last month</option><option value="custom">Custom dates</option></select></div>{range === 'custom' && <div className="mt-2 flex flex-wrap items-center gap-2"><label className="text-xs text-stone-500">From <input type="date" value={customStart} onChange={(event) => setCustomStart(event.target.value)} className="ml-1 h-9 rounded border border-stone-200 px-2 text-xs" /></label><label className="text-xs text-stone-500">To <input type="date" value={customEnd} onChange={(event) => setCustomEnd(event.target.value)} className="ml-1 h-9 rounded border border-stone-200 px-2 text-xs" /></label></div>}</section>

    {selectedIds.length > 0 && <section className="grid gap-2 rounded-lg border border-[#cfe1d8] bg-[#f2f8f4] p-3 md:grid-cols-[auto_minmax(160px,1fr)_minmax(180px,1fr)_minmax(220px,1.5fr)_auto] md:items-center"><span className="px-1 text-xs font-bold text-[#245b45]">{selectedIds.length}টি নির্বাচিত</span><select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction)} aria-label="Bulk action" className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs"><option value="status">স্ট্যাটাস পরিবর্তন</option><option value="assignStaff">কর্মী অ্যাসাইন</option><option value="assignCourier">কুরিয়ার অ্যাসাইন</option><option value="dispatchCourier">Courier dispatch</option><option value="fake">Fake হিসেবে চিহ্নিত</option><option value="sms">SMS পাঠান</option><option value="printInvoice">Invoice প্রিন্ট</option><option value="printLabel">Shipping label / barcode</option></select>{['status', 'assignCourier', 'dispatchCourier'].includes(bulkAction) ? <select value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} className="h-10 rounded-md border border-stone-200 bg-white px-2 text-xs">{(bulkAction === 'status' ? orderStatuses : couriers).map((value) => <option key={value}>{value}</option>)}</select> : bulkAction === 'assignStaff' ? <input value={bulkValue} onChange={(event) => setBulkValue(event.target.value)} placeholder="কর্মীর নাম" className="h-10 rounded-md border border-stone-200 px-3 text-xs" /> : bulkAction === 'sms' ? <input value={bulkMessage} onChange={(event) => setBulkMessage(event.target.value)} maxLength={500} placeholder="Custom SMS (সর্বোচ্চ ৫০০ অক্ষর)" className="h-10 rounded-md border border-stone-200 px-3 text-xs" /> : <span className="text-[11px] text-[#6c7e75]">{bulkAction.startsWith('print') ? 'নির্বাচিত অর্ডারের জন্য print view' : bulkAction === 'fake' ? 'নির্বাচিত অর্ডারে fraud flag যোগ হবে' : 'Courier credentials প্রয়োজন'}</span>}<button type="button" onClick={() => void runBulk()} disabled={bulkBusy || !selectedIds.length} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-md bg-[#176b52] px-3 text-xs font-bold text-white disabled:opacity-50">{bulkBusy ? <LoaderCircle className="size-4 animate-spin" /> : bulkAction === 'sms' ? <Send className="size-4" /> : bulkAction.startsWith('print') ? <Printer className="size-4" /> : <Check className="size-4" />}Apply</button><button type="button" onClick={() => setSelectedIds([])} className="grid size-9 place-items-center rounded-md border border-stone-200 bg-white text-stone-500"><X className="size-4" /></button></section>}

    {toast && <p role="status" className="fixed bottom-5 right-5 z-50 inline-flex items-center gap-2 rounded-full bg-[#123d3a] px-4 py-3 text-sm font-bold text-white shadow-xl"><Check className="size-4" />{toast}</p>}
    {loading ? <div className="rounded-lg border border-stone-200 bg-white px-5 py-12 text-center text-sm text-stone-500">অর্ডার লোড হচ্ছে...</div> : <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white"><table className="w-full min-w-[1450px] text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold text-stone-500"><tr><th className="w-10 px-3 py-3"><input type="checkbox" checked={allVisibleSelected} onChange={selectVisible} aria-label="দেখানো সব অর্ডার নির্বাচন" /></th><th className="px-3 py-3">অর্ডার</th><th className="px-3 py-3">কাস্টমার</th><th className="px-3 py-3">ঠিকানা</th><th className="px-3 py-3">পণ্য</th><th className="px-3 py-3">সোর্স / কর্মী</th><th className="px-3 py-3">Courier</th><th className="px-3 py-3">মোট</th><th className="px-3 py-3">স্ট্যাটাস</th><th className="px-3 py-3">অ্যাকশন</th></tr></thead><tbody className="divide-y divide-stone-100">{visibleOrders.map((order) => {
      const name = getCustomerName(order); const phone = getCustomerPhone(order); const address = getOrderShippingDetails(order); const selected = selectedIds.includes(order._id);
      return <tr key={order._id} tabIndex={0} aria-label={`অর্ডার #${order._id.slice(-8).toUpperCase()} বিস্তারিত খুলুন`} onClick={() => setDetailId(order._id)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setDetailId(order._id); } }} className="cursor-pointer align-top transition-colors duration-150 hover:bg-emerald-50/60 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-700"><td onClick={(event) => event.stopPropagation()} className="px-3 py-3"><input type="checkbox" checked={selected} onChange={() => setSelectedIds((current) => selected ? current.filter((id) => id !== order._id) : [...current, order._id])} aria-label={`অর্ডার ${order._id} নির্বাচন`} /></td><td className="whitespace-nowrap px-3 py-3"><button type="button" onClick={() => setDetailId(order._id)} className="font-mono text-xs font-bold text-[#176b52] underline-offset-2 transition hover:text-emerald-900 hover:underline">#{order._id.slice(-8).toUpperCase()}</button><span className="mt-1 block text-[10px] text-stone-500">{new Date(order.createdAt).toLocaleString('bn-BD', { dateStyle: 'short', timeStyle: 'short' })}</span></td><td className="px-3 py-3"><strong className="block max-w-40 truncate text-xs">{name || 'নাম উল্লেখ নেই'}</strong><a onClick={(event) => event.stopPropagation()} href={`tel:${phone}`} className="mt-1 block text-xs font-bold text-[#176b52]">{phone}</a><span className="text-[10px] text-stone-500">{order.customerIp || ''}</span></td><td className="max-w-52 px-3 py-3 text-xs leading-5"><span className="block truncate">{address.district || '—'} · {address.thana || '—'}</span><span className="block max-w-48 truncate text-stone-500">{address.address || 'ঠিকানা নেই'}</span></td><td className="px-3 py-3">{order.items?.slice(0, 2).map((item, index) => <span key={`${item.name}-${index}`} className="mb-1 flex max-w-48 items-center gap-2"><span className="size-8 shrink-0 overflow-hidden rounded bg-stone-100">{normalizeImageUrl(item.imageUrl || '') && <img src={normalizeImageUrl(item.imageUrl || '')} alt="" className="size-full object-cover" />}</span><span className="truncate text-[11px]">{item.name} ×{item.quantity}</span></span>)}{(order.items?.length || 0) > 2 && <span className="text-[10px] text-stone-400">+{order.items!.length - 2} more</span>}</td><td className="px-3 py-3 text-xs"><span>{order.source || 'Website'}</span><span className="mt-1 block text-[10px] text-stone-500">{order.assignedStaff || 'Unassigned'}</span></td><td className="px-3 py-3 text-xs"><span>{order.courierName || '—'}</span><span className="mt-1 block text-[10px] text-stone-500">{order.trackingId || order.courierStatus || ''}</span></td><td className="whitespace-nowrap px-3 py-3 font-black">{money(Number(order.totalAmount || 0))}</td><td onClick={(event) => event.stopPropagation()} className="px-3 py-3"><span className={`mb-2 inline-flex whitespace-nowrap rounded-full px-2 py-1 text-[10px] font-extrabold transition duration-150 hover:scale-105 hover:shadow-sm ${statusStyle[order.status] || statusStyle.Pending}`}>{order.status}</span><select value={order.status} disabled={savingId === order._id || Boolean(order.isAbandonedCart)} onChange={(event) => void handleStatusChange(order._id, event.target.value)} aria-label={`${order._id} স্ট্যাটাস`} className="block h-8 max-w-40 rounded-md border border-stone-200 bg-white px-2 text-[10px] disabled:cursor-not-allowed disabled:bg-stone-50">{orderStatuses.map((status) => <option key={status}>{status}</option>)}</select></td><td onClick={(event) => event.stopPropagation()} className="px-3 py-3"><div className="flex flex-col items-start gap-1.5"><button type="button" onClick={() => void copyOrderDetails(order)} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-stone-200 px-2 text-[10px] font-bold transition hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50">{copiedId === order._id ? <Check className="size-3" /> : <Copy className="size-3" />}{copiedId === order._id ? 'কপি' : 'তথ্য কপি'}</button><a href={`tel:${phone}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-md bg-teal-50 px-2 text-[10px] font-bold text-teal-800 transition hover:-translate-y-0.5 hover:bg-teal-100"><Phone className="size-3" />কল</a></div></td></tr>;
    })}</tbody></table>{visibleOrders.length === 0 && <div className="px-5 py-12 text-center"><p className="font-bold">কোনো অর্ডার মেলেনি</p><p className="mt-1 text-xs text-stone-500">ফিল্টার বা সার্চ পরিবর্তন করুন।</p></div>}</div>}

    {selectedOrder && <AdminOrderDetails key={selectedOrder._id} order={selectedOrder} isAbandonedCart={selectedOrder.isAbandonedCart} saving={savingId === selectedOrder._id} products={products} previousOrder={detailIndex < visibleOrders.length - 1 ? visibleOrders[detailIndex + 1]?._id : undefined} nextOrder={detailIndex > 0 ? visibleOrders[detailIndex - 1]?._id : undefined} onClose={() => setDetailId('')} onNavigate={setDetailId} onRefresh={() => void reload().catch(() => undefined)} onStatusChange={handleStatusChange} onUpdate={updateOrder} />}

    {printMode && <div className="admin-orders-print-only">{printOrders.map((order) => <article key={order._id} className="mb-8 break-inside-avoid border border-black p-5"><div className="flex justify-between"><strong>{printMode === 'invoice' ? 'INVOICE' : 'SHIPPING LABEL'}</strong><span>#{order._id}</span></div><OrderBarcode value={order.trackingId || order._id} className="my-4 h-12 w-64" /><p>{getCustomerName(order)} · {getCustomerPhone(order)}</p><p>{getOrderShippingDetails(order).address}</p><p>{order.district} · {order.thana}</p><ul className="my-3">{order.items?.map((item, index) => <li key={index}>{item.name} × {item.quantity} · {money(Number(item.price || 0) * Number(item.quantity || 0))}</li>)}</ul><strong>Total {money(Number(order.totalAmount || 0))}</strong></article>)}</div>}
  </div>;
}