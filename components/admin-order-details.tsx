'use client';

import { useEffect, useEffectEvent, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, ArrowLeft, ArrowRight, ExternalLink, LoaderCircle, MapPin, Plus, Printer, Save, ShieldCheck, Trash2, Truck, X } from 'lucide-react';
import { normalizeImageUrl } from '@/lib/image-url';
import { getCustomerName, getCustomerPhone, getOrderShippingDetails } from '@/lib/order-format';
import { findBangladeshDistrict } from '@/lib/bangladesh-locations';
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
  shippingFee?: number;
  discountAmount?: number;
  discountType?: 'flat' | 'percentage';
  discountValue?: number;
  taxAmount?: number;
  totalAmount?: number;
  paymentMethod?: string;
  status: string;
  source?: string;
  assignedStaff?: string;
  courierName?: string;
  courierStatus?: string;
  trackingId?: string;
  customerIp?: string;
  addressCorrection?: string;
  advancePayment?: { amount?: number; gateway?: string; transactionId?: string; receivedBy?: string; receivedAt?: string };
  fraudCheck?: { totalOrders?: number; delivered?: number; returned?: number; cancelled?: number; successRate?: number; returnRate?: number; cancellationRate?: number; provider?: string; mock?: boolean; checkedAt?: string };
  activityLog?: { action: string; actor: string; details?: string; createdAt: string }[];
  createdAt: string;
};
type Product = { _id: string; name: string; price: number; imageUrl?: string; images?: string[]; stock?: number };
type CustomerHistory = { totalOrders: number; totalSpent: number; delivered: number; returned: number; cancelled: number; successRate: number; orders: { id: string; status: string; totalAmount: number; createdAt: string; itemCount: number }[] };
type IpLocation = { ip: string; city?: string; district?: string; thana?: string; division?: string; region?: string; country?: string; isp?: string; latitude?: number | null; longitude?: number | null };

const statuses = ['New', 'Incomplete', 'Pending Response', 'No Response', 'Fake', 'Advance Payment', 'Confirmed', 'On Hold', 'Processing', 'Ready For Pickup', 'Pending (Courier)', 'In Transit', 'Delivered', 'Partial Delivered', 'Returned', 'Cancelled', 'Lost', 'Pending', 'Shipped'];
const couriers = ['Steadfast', 'Pathao', 'RedX', 'Carrybee'];
const money = (amount: number) => `৳${new Intl.NumberFormat('bn-BD').format(amount || 0)}`;

async function fetchIpLocation(ip: string): Promise<IpLocation> {
  const response = await fetch(`/api/admin/orders/ip-lookup?ip=${encodeURIComponent(ip)}`);
  const result = await response.json();
  if (!response.ok || !result.success) throw new Error(result.error || 'IP location পাওয়া যায়নি।');
  return result.data as IpLocation;
}

export default function AdminOrderDetails({ order: orderInput, isAbandonedCart = false, saving, products, previousOrder, nextOrder, onClose, onStatusChange, onUpdate, onRefresh, onNavigate }: {
  order: Order;
  isAbandonedCart?: boolean;
  saving: boolean;
  products: Product[];
  previousOrder?: string;
  nextOrder?: string;
  onClose: () => void;
  onStatusChange: (id: string, status: string) => void;
  onUpdate: (id: string, update: Record<string, unknown>) => Promise<void>;
  onRefresh: () => void;
  onNavigate: (id: string) => void;
}) {
  const [resolvedIp, setResolvedIp] = useState('');
  const [fraudResults, setFraudResults] = useState(orderInput.fraudCheck?.mock ? null : orderInput.fraudCheck || null);
  const order = { ...orderInput, customerIp: resolvedIp || orderInput.customerIp, fraudCheck: fraudResults || (orderInput.fraudCheck?.mock ? undefined : orderInput.fraudCheck) };
  const delivery = getOrderShippingDetails(order);
  const [items, setItems] = useState<OrderItem[]>(() => (order.items || []).map((item) => ({ ...item })));
  const [shippingFee, setShippingFee] = useState(Number(order.shippingFee || 0));
  const [shippingChoice, setShippingChoice] = useState([80, 150].includes(Number(order.shippingFee || 0)) ? String(order.shippingFee) : 'custom');
  const [discountType, setDiscountType] = useState<'flat' | 'percentage'>(order.discountType || 'flat');
  const [discountValue, setDiscountValue] = useState(Number(order.discountValue ?? order.discountAmount ?? 0));
  const [taxAmount, setTaxAmount] = useState(Number(order.taxAmount || 0));
  const [staff, setStaff] = useState(order.assignedStaff || '');
  const [correctedAddress, setCorrectedAddress] = useState(order.addressCorrection || delivery.address || '');
  const [gateway, setGateway] = useState('bKash');
  const [advanceAmount, setAdvanceAmount] = useState(Number(order.advancePayment?.amount || 0));
  const [transactionId, setTransactionId] = useState(order.advancePayment?.transactionId || '');
  const [productToAdd, setProductToAdd] = useState('');
  const [courier, setCourier] = useState('Steadfast');
  const [history, setHistory] = useState<CustomerHistory | null>(null);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [fraudProviderMessage, setFraudProviderMessage] = useState('');
  const [ipLocation, setIpLocation] = useState('');
  const [ipLocationData, setIpLocationData] = useState<IpLocation | null>(null);
  const customerPhone = getCustomerPhone(order);
  const orderId = order._id;
  const refreshOrder = useEffectEvent(onRefresh);
  const closeDrawer = useEffectEvent(onClose);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/orders/${orderId}/customer-history`)
      .then((response) => response.json())
      .then((result) => { if (active && result.success) setHistory(result.data); })
      .catch(() => undefined);
    return () => { active = false; };
  }, [orderId]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeDrawer();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [orderId]);

  const subtotal = items.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const computedDiscount = discountType === 'percentage'
    ? Math.min(subtotal, subtotal * Math.min(discountValue, 100) / 100)
    : Math.min(subtotal, discountValue);
  const total = Math.max(0, subtotal - computedDiscount + taxAmount + shippingFee);
  const barcodeValue = order.trackingId || String(order._id);

  const saveChanges = async () => {
    if (isAbandonedCart) return;
    setBusy('save'); setError(''); setNotice('');
    try {
      await onUpdate(order._id, {
        items,
        shippingFee,
        discountType,
        discountValue,
        taxAmount,
        assignedStaff: staff,
        customerAddress: correctedAddress,
        shippingAddress: correctedAddress,
        addressCorrection: correctedAddress,
        advancePayment: { amount: advanceAmount, gateway: advanceAmount ? gateway : '', transactionId },
      });
      setNotice('পরিবর্তন সংরক্ষণ হয়েছে');
      onRefresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'পরিবর্তন সংরক্ষণ করা যায়নি।');
    } finally { setBusy(''); }
  };

  const runCourierDispatch = async () => {
    if (isAbandonedCart) return;
    setBusy('courier'); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/orders/${order._id}/dispatch`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courier }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Courier dispatch করা যায়নি।');
      setNotice(`${courier} booking সম্পন্ন · ${result.data.trackingId}`);
      onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Courier dispatch করা যায়নি।'); }
    finally { setBusy(''); }
  };

  const blockCustomer = async (blockIp: boolean) => {
    setBusy('block'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/blocked-customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getCustomerPhone(order), ip: blockIp ? orderInput.customerIp : '', reason: `Blocked from order ${order._id}` }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Block করা যায়নি।');
      setNotice(blockIp ? 'ফোন ও IP ব্লক করা হয়েছে' : 'ফোন নম্বর ব্লক করা হয়েছে');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Block করা যায়নি।'); }
    finally { setBusy(''); }
  };

  const runFraudCheck = async () => {
    if (isAbandonedCart) return;
    setBusy('fraud'); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/orders/fraud-check', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: getCustomerPhone(order), orderId: order._id }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Fraud check করা যায়নি।');
      if (!result.configured) {
        setFraudProviderMessage(result.message || 'Courier fraud provider is not configured.');
        return;
      }
      setFraudProviderMessage(result.warning || '');
      setFraudResults({ ...result.statistics, provider: result.provider, mock: false, checkedAt: result.checkedAt || new Date().toISOString() });
      setNotice(result.cached ? 'Cached courier history loaded' : 'Fraud check সম্পন্ন হয়েছে');
      onRefresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Fraud check করা যায়নি।'); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    let active = true;
    if (isAbandonedCart || !/^01[3-9]\d{8}$/.test(customerPhone)) return () => { active = false; };
    void fetch('/api/admin/orders/fraud-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: customerPhone, orderId }),
    }).then((response) => response.json()).then((result) => {
      if (!active) return;
      if (!result.success) setFraudProviderMessage(result.error || 'Fraud check unavailable.');
      else if (!result.configured) setFraudProviderMessage(result.message || 'Courier fraud provider is not configured.');
      else if (result.success) {
        setFraudProviderMessage(result.warning || '');
        setFraudResults({ ...result.statistics, provider: result.provider, mock: false, checkedAt: result.checkedAt || new Date().toISOString() });
        refreshOrder();
      }
    }).catch((reason) => { if (active) setFraudProviderMessage(reason instanceof Error ? reason.message : 'Fraud provider could not be reached.'); });
    return () => { active = false; };
  }, [orderId, customerPhone, isAbandonedCart]);

  const lookupIp = async () => {
    if (!order.customerIp) return;
    setBusy('ip'); setError('');
    try {
      const location = await fetchIpLocation(order.customerIp);
      const place = [location.thana, location.district || location.city, location.division || location.region, location.country].filter(Boolean).join(', ') || 'Location unavailable';
      const coordinates = Number.isFinite(Number(location.latitude)) && Number.isFinite(Number(location.longitude)) ? ` · ${location.latitude}, ${location.longitude}` : '';
      setResolvedIp(location.ip || '');
      setIpLocation(`${place}${coordinates}`);
      setIpLocationData(location);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'IP location পাওয়া যায়নি।'); }
    finally { setBusy(''); }
  };

  useEffect(() => {
    if (!order.customerIp || ipLocationData?.ip === order.customerIp || isAbandonedCart) return;
    let active = true;
    fetchIpLocation(order.customerIp)
      .then((location) => {
        if (!active) return;
        setResolvedIp(location.ip || '');
        setIpLocationData(location);
        const place = [location.thana, location.district || location.city, location.division || location.region, location.country].filter(Boolean).join(', ');
        setIpLocation(place);
      })
      .catch((reason: unknown) => {
        if (active) setError(reason instanceof Error ? reason.message : 'IP location পাওয়া যায়নি।');
      });
    return () => { active = false; };
  }, [order.customerIp, ipLocationData?.ip, isAbandonedCart]);

  const shippingDistrict = (delivery.district || '').trim().toLocaleLowerCase();
  const detectedDistrict = (ipLocationData?.district || ipLocationData?.city || '').trim().toLocaleLowerCase();
  const shippingDistrictId = findBangladeshDistrict(delivery.district || '')?.id;
  const detectedDistrictId = findBangladeshDistrict(ipLocationData?.district || ipLocationData?.city || '')?.id;
  const locationMismatch = Boolean(shippingDistrict && detectedDistrict && !(
    (shippingDistrictId && detectedDistrictId && shippingDistrictId === detectedDistrictId)
    || shippingDistrict === detectedDistrict
    || shippingDistrict.includes(detectedDistrict)
    || detectedDistrict.includes(shippingDistrict)
  ));

  const addItem = () => {
    const product = products.find((item) => item._id === productToAdd);
    if (!product) return;
    const existing = items.find((item) => item.productId === product._id);
    setItems(existing
      ? items.map((item) => item.productId === product._id ? { ...item, quantity: Number(item.quantity || 0) + 1 } : item)
      : [...items, { productId: product._id, name: product.name, price: product.price, quantity: 1, imageUrl: product.images?.[0] || product.imageUrl || '' }]);
    setProductToAdd('');
  };

  const openMaps = () => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(correctedAddress || `${delivery.district}, ${delivery.thana}`)}`, '_blank', 'noopener,noreferrer');

  if (typeof document === 'undefined') return null;

  return createPortal(<div className="order-workspace fixed inset-0 z-[100] flex h-dvh w-full overflow-hidden bg-black/60 text-slate-900 opacity-100 [color-scheme:light]" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section role="dialog" aria-modal="true" aria-labelledby="order-detail-title" className="relative flex h-full min-h-0 w-full max-w-none flex-col overflow-hidden border border-slate-200 bg-white text-slate-900 opacity-100 shadow-2xl">
    <header className="sticky top-0 z-20 flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-stone-200 bg-white px-4 py-3 shadow-sm sm:px-6 lg:px-8"><div className="flex min-w-0 items-center gap-3"><div className="flex shrink-0 gap-1"><button type="button" onClick={() => previousOrder && onNavigate(previousOrder)} disabled={!previousOrder} aria-label="আগের অর্ডার" className="grid size-9 place-items-center rounded-md border border-stone-200 transition hover:bg-stone-50 disabled:opacity-30"><ArrowLeft className="size-4" /></button><button type="button" onClick={() => nextOrder && onNavigate(nextOrder)} disabled={!nextOrder} aria-label="পরের অর্ডার" className="grid size-9 place-items-center rounded-md border border-stone-200 transition hover:bg-stone-50 disabled:opacity-30"><ArrowRight className="size-4" /></button></div><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#64766d]">Order workspace</p><h2 id="order-detail-title" className="truncate text-base font-black sm:text-lg">অর্ডার #{order._id.slice(-8).toUpperCase()}</h2>{isAbandonedCart && <span className="text-[10px] font-bold text-amber-700">Incomplete cart · inspection only</span>}</div></div><div className="flex shrink-0 items-center gap-2"><button type="button" onClick={() => window.print()} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-stone-200 px-3 text-xs font-bold transition hover:bg-stone-50"><Printer className="size-4" />Print</button><button type="button" onClick={onClose} aria-label="Close order details" className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-rose-300 bg-rose-50 px-3 text-sm font-bold text-rose-800 shadow-sm transition hover:border-rose-400 hover:bg-rose-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-700"><X className="size-4" /><span>Close</span></button></div></header>
    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
    <div className="mx-auto grid w-full max-w-7xl grid-cols-1 items-start gap-5 p-4 sm:p-6 lg:grid-cols-2 lg:gap-6 lg:p-8">
      <div className="space-y-4">
        <section className="rounded-lg border border-stone-200 bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold">IP location verification</h3>
            {locationMismatch && <span role="status" className="inline-flex items-center gap-1.5 rounded-full border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs font-extrabold text-rose-800"><AlertTriangle className="size-3.5" />Shipping location differs from IP estimate</span>}
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md bg-stone-50 p-3 text-xs">
              <p className="font-bold text-stone-800">Checkout shipping address</p>
              <p className="mt-1 text-stone-600">{delivery.district || 'District unavailable'}{delivery.thana ? ` · ${delivery.thana}` : ''}</p>
              <p className="mt-1 text-stone-500">{delivery.address || 'Address unavailable'}</p>
            </div>
            <div className="rounded-md bg-stone-50 p-3 text-xs">
              <p className="font-bold text-stone-800">Detected IP location</p>
              {ipLocationData ? <>
                <p className="mt-1 text-stone-600">District: {ipLocationData.district || ipLocationData.city || 'Not available'}</p>
                <p className="mt-1 text-stone-600">Thana / upazila: {ipLocationData.thana || 'Not available from IP provider'}</p>
                <p className="mt-1 text-stone-600">Division / region: {ipLocationData.division || ipLocationData.region || 'Not available'}</p>
                <p className="mt-1 text-stone-600">ISP: {ipLocationData.isp || 'Not available'}</p>
                <p className="mt-1 text-stone-500">Country: {ipLocationData.country || 'Not available'} · IP: {ipLocationData.ip}</p>
              </> : <p className="mt-1 text-stone-500">{order.customerIp ? busy === 'ip' ? 'Location is being detected…' : ipLocation || 'No IP location data yet.' : 'Customer IP was not captured for this order.'}</p>}
              {ipLocationData && <p className="mt-1 text-[10px] text-stone-500">IP-based location is approximate and may not identify the exact district.</p>}
            </div>
          </div>
          {order.customerIp && <button type="button" onClick={() => void lookupIp()} disabled={busy === 'ip'} className="mt-3 inline-flex min-h-8 items-center gap-1.5 rounded-md border border-stone-200 px-2.5 text-[11px] font-bold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"><MapPin className="size-3.5" />{busy === 'ip' ? 'Detecting location…' : 'Refresh IP location'}</button>}
        </section>
        <section className="rounded-lg border border-stone-200 p-4"><label className="block text-xs font-extrabold">ঠিকানা সংশোধন<textarea rows={3} value={correctedAddress} readOnly={isAbandonedCart} onChange={(event) => setCorrectedAddress(event.target.value)} className="mt-2 w-full rounded-md border border-stone-300 px-3 py-2 text-xs leading-5 read-only:bg-stone-50" /><span className="mt-1 block text-[10px] font-normal text-stone-500">{isAbandonedCart ? 'এটি অসম্পূর্ণ কার্ট; অর্ডার তৈরি না হওয়া পর্যন্ত পরিবর্তন সংরক্ষণ করা যাবে না।' : 'মানচিত্র যাচাইয়ের পর সংশোধিত ঠিকানা সংরক্ষণ করুন।'}</span></label></section>
        <section className="rounded-lg border border-stone-200 p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-sm font-extrabold">কাস্টমার ও ডেলিভারি</h3><p className="mt-1 text-[11px] text-stone-500">{new Date(order.createdAt).toLocaleString('bn-BD', { dateStyle: 'medium', timeStyle: 'short' })} · {order.source || 'Website'}</p></div><button type="button" onClick={openMaps} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-stone-200 px-3 text-xs font-bold text-[#1b5f48] hover:bg-[#f0f7f3]"><MapPin className="size-3.5" />Maps যাচাই</button></div><div className="mt-3 grid gap-3 sm:grid-cols-2"><div className="rounded-md bg-stone-50 p-3"><p className="text-xs font-bold">{getCustomerName(order) || 'নাম উল্লেখ নেই'}</p><a href={`tel:${getCustomerPhone(order)}`} className="mt-1 block text-sm font-bold text-[#176b52]">{getCustomerPhone(order) || 'ফোন নেই'}</a><p className="mt-1 break-all text-[11px] text-stone-500">{order.userEmail || order.email || ''}</p></div><div className="rounded-md bg-stone-50 p-3 text-xs leading-5"><p><strong>জেলা:</strong> {delivery.district || 'উল্লেখ নেই'} · <strong>থানা:</strong> {delivery.thana || 'উল্লেখ নেই'}</p><p className="mt-1">{delivery.address || 'ঠিকানা উল্লেখ নেই'}</p><a href={`https://www.google.com/search?q=${encodeURIComponent(`correct address spelling ${delivery.address || ''}`)}`} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 font-bold text-[#176b52]">ঠিকানা যাচাই / সংশোধন <ExternalLink className="size-3" /></a></div></div><div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-stone-100 pt-3 text-xs"><span className="text-stone-500">IP: <strong className="font-mono text-stone-800">{order.customerIp || 'সংরক্ষিত নেই'}</strong>{ipLocation && <span className="ml-2">{ipLocation}</span>}</span><div className="flex flex-wrap gap-2"><button type="button" disabled={!order.customerIp || busy === 'block'} onClick={() => void blockCustomer(true)} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-rose-200 px-2.5 font-bold text-rose-700 disabled:opacity-40"><ShieldCheck className="size-3.5" />ফোন + IP ব্লক</button><button type="button" disabled={!order.customerIp || busy === 'ip'} onClick={() => void lookupIp()} className="inline-flex min-h-8 items-center gap-1 rounded-md border border-stone-200 px-2.5 font-bold text-stone-600 disabled:opacity-40"><MapPin className="size-3.5" />{busy === 'ip' ? 'খোঁজা হচ্ছে...' : 'IP location'}</button><button type="button" onClick={() => void blockCustomer(false)} disabled={busy === 'block'} className="min-h-8 rounded-md border border-rose-200 px-2.5 font-bold text-rose-700">ফোন ব্লক</button></div></div></section>

        <section className="rounded-lg border border-stone-200 p-4"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-extrabold">অর্ডারের পণ্য</h3><div className="flex gap-2"><select value={productToAdd} onChange={(event) => setProductToAdd(event.target.value)} className="h-9 max-w-52 rounded-md border border-stone-300 bg-white px-2 text-xs"><option value="">পণ্য যোগ করুন...</option>{products.map((product) => <option key={product._id} value={product._id}>{product.name} · {money(product.price)}</option>)}</select><button type="button" onClick={addItem} disabled={!productToAdd} className="inline-flex size-9 items-center justify-center rounded-md bg-[#176b52] text-white disabled:opacity-40"><Plus className="size-4" /></button></div></div><div className="mt-3 divide-y divide-stone-100 border-y border-stone-100">{items.map((item, index) => <div key={`${item.productId || item.name}-${index}`} className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-2 py-2.5"><div className="size-11 overflow-hidden rounded-md bg-stone-100">{normalizeImageUrl(item.imageUrl || '') && <img src={normalizeImageUrl(item.imageUrl || '')} alt="" className="size-full object-cover" />}</div><div className="grid min-w-0 gap-1 sm:grid-cols-[minmax(0,1fr)_70px_80px]"><span className="truncate text-xs font-bold">{item.name}</span><input aria-label={`${item.name} variant`} value={item.variant || item.size || ''} onChange={(event) => setItems((current) => current.map((line, row) => row === index ? { ...line, variant: event.target.value, size: event.target.value } : line))} placeholder="Size / color" className="h-8 w-full rounded border border-stone-200 px-2 text-[10px]" /><div className="flex h-8 items-center border border-stone-200"><button type="button" onClick={() => setItems((current) => current.map((line, row) => row === index ? { ...line, quantity: Math.max(1, Number(line.quantity || 1) - 1) } : line))} className="grid size-7 place-items-center">−</button><span className="min-w-5 text-center text-xs">{item.quantity}</span><button type="button" onClick={() => setItems((current) => current.map((line, row) => row === index ? { ...line, quantity: Number(line.quantity || 0) + 1 } : line))} className="grid size-7 place-items-center">+</button></div></div><div className="flex items-center gap-2"><strong className="text-xs">{money(Number(item.price || 0) * Number(item.quantity || 0))}</strong><button type="button" aria-label={`${item.name} সরান`} onClick={() => setItems((current) => current.filter((_, row) => row !== index))} className="grid size-8 place-items-center rounded text-rose-600 hover:bg-rose-50"><Trash2 className="size-4" /></button></div></div>)}</div></section>

        <section className="rounded-lg border border-stone-200 p-4">
          <h3 className="text-sm font-extrabold">গ্রাহকের অর্ডার ইতিহাস</h3>
          {history ? <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['মোট অর্ডার', history.totalOrders],
                ['খরচ', money(history.totalSpent)],
                ['Delivered', history.delivered],
                ['Success rate', `${history.successRate}%`],
              ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-stone-50 p-2.5"><span className="block text-[10px] text-stone-500">{label}</span><strong className="mt-1 block text-sm">{value}</strong></div>)}
            </div>
            <div className="mt-2 flex gap-4 text-[11px] text-stone-500"><span>Returned: {history.returned}</span><span>Cancelled: {history.cancelled}</span></div>
            <ul className="mt-3 divide-y divide-stone-100">{history.orders.slice(0, 4).map((entry) => <li key={entry.id} className="flex justify-between gap-3 py-2 text-xs"><span>#{entry.id.slice(-8).toUpperCase()} · {entry.status} · {new Date(entry.createdAt).toLocaleDateString('bn-BD')}</span><strong>{money(entry.totalAmount)}</strong></li>)}</ul>
          </> : <p className="mt-3 text-xs text-stone-500">কাস্টমার ইতিহাস লোড হচ্ছে...</p>}
          <button type="button" onClick={() => void runFraudCheck()} disabled={isAbandonedCart || busy === 'fraud'} className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 text-xs font-bold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-50">
            <AlertTriangle className="size-3.5" />{isAbandonedCart ? 'Incomplete cart · fraud check unavailable' : busy === 'fraud' ? 'যাচাই হচ্ছে...' : 'Courier fraud check'}
          </button>
          {fraudProviderMessage && <p role="status" className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-[10px] leading-4 text-amber-900">{fraudProviderMessage}</p>}
          {order.fraudCheck?.checkedAt && <>
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ['মোট অর্ডার', order.fraudCheck.totalOrders ?? '—'],
                ['Delivered', order.fraudCheck.delivered ?? '—'],
                ['Returned / cancelled', order.fraudCheck.returned ?? order.fraudCheck.cancelled ?? '—'],
                ['Success rate', `${order.fraudCheck.successRate ?? '—'}%`],
              ].map(([label, value]) => <div key={String(label)} className="rounded-md bg-[#f4f7f5] p-2"><span className="block text-[9px] text-stone-500">{label}</span><strong className="mt-1 block text-xs">{value}</strong></div>)}
            </div>
            <p className="mt-2 text-[10px] text-stone-500">{order.fraudCheck.provider} · Checked {new Date(order.fraudCheck.checkedAt).toLocaleString('bn-BD')}</p>
          </>}
        </section>
      </div>

      <div className="space-y-4">
        {isAbandonedCart && <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900">Incomplete cart data is available for inspection only. Convert it into an order before changing fulfillment or payment details.</p>}
        <fieldset disabled={isAbandonedCart} className="space-y-4">
        <section className="rounded-lg border border-stone-200 p-4"><h3 className="text-sm font-extrabold">অর্ডার পরিচালনা</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-stone-600">স্ট্যাটাস<select value={order.status} disabled={saving} onChange={(event) => onStatusChange(order._id, event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-xs">{statuses.map((status) => <option key={status}>{status}</option>)}</select></label><label className="text-xs font-bold text-stone-600">দায়িত্বপ্রাপ্ত কর্মী<input value={staff} onChange={(event) => setStaff(event.target.value)} placeholder="Unassigned" className="mt-1.5 h-10 w-full rounded-md border border-stone-300 px-3 text-xs" /></label><label className="text-xs font-bold text-stone-600">Courier<select value={courier} onChange={(event) => setCourier(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-xs">{couriers.map((name) => <option key={name}>{name}</option>)}</select></label><div className="flex items-end"><button type="button" onClick={() => void runCourierDispatch()} disabled={busy === 'courier' || Boolean(order.trackingId)} className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-[#176b52] px-3 text-xs font-bold text-white disabled:opacity-45"><Truck className="size-4" />{busy === 'courier' ? 'Booking...' : order.trackingId ? 'ইতিমধ্যে বুক হয়েছে' : 'Courier-এ পাঠান'}</button></div></div>{order.trackingId && <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-md bg-stone-50 p-3"><div><p className="text-xs font-bold">{order.courierName} · {order.courierStatus || 'Booked'}</p><p className="mt-1 font-mono text-xs text-stone-600">Tracking: {order.trackingId}</p><a href={`https://www.google.com/search?q=${encodeURIComponent(`${order.courierName} tracking ${order.trackingId}`)}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-[#176b52]">Tracking lookup <ExternalLink className="size-3" /></a></div><OrderBarcode value={barcodeValue} className="h-10 w-36 bg-white" /></div>}</section>

        <section className="rounded-lg border border-stone-200 p-4"><h3 className="text-sm font-extrabold">অর্থ ও পেমেন্ট</h3><div className="mt-3 grid gap-3 sm:grid-cols-2"><label className="text-xs font-bold text-stone-600">ডেলিভারি চার্জ<select value={shippingChoice} onChange={(event) => { setShippingChoice(event.target.value); if (event.target.value !== 'custom') setShippingFee(Number(event.target.value)); }} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-xs"><option value="80">৳৮০</option><option value="150">৳১৫০</option><option value="custom">Custom</option></select>{shippingChoice === 'custom' && <input type="number" min="0" value={shippingFee} onChange={(event) => setShippingFee(Number(event.target.value))} className="mt-1.5 h-9 w-full rounded-md border border-stone-300 px-2 text-xs" />}</label><label className="text-xs font-bold text-stone-600">Discount type<select value={discountType} onChange={(event) => setDiscountType(event.target.value as 'flat' | 'percentage')} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-xs"><option value="flat">Flat amount</option><option value="percentage">Percentage</option></select><input type="number" min="0" max={discountType === 'percentage' ? 100 : undefined} value={discountValue} onChange={(event) => setDiscountValue(Number(event.target.value))} className="mt-1.5 h-9 w-full rounded-md border border-stone-300 px-2 text-xs" /></label><label className="text-xs font-bold text-stone-600">Tax<input type="number" min="0" value={taxAmount} onChange={(event) => setTaxAmount(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 px-3 text-xs" /></label><label className="text-xs font-bold text-stone-600">Advance amount<input type="number" min="0" max={total} value={advanceAmount} onChange={(event) => setAdvanceAmount(Number(event.target.value))} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 px-3 text-xs" /></label><label className="text-xs font-bold text-stone-600">Payment gateway<select value={gateway} onChange={(event) => setGateway(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 bg-white px-2 text-xs"><option>bKash</option><option>Nagad</option><option>Rocket</option></select></label><label className="text-xs font-bold text-stone-600">Transaction ID<input value={transactionId} onChange={(event) => setTransactionId(event.target.value)} className="mt-1.5 h-10 w-full rounded-md border border-stone-300 px-3 text-xs" /></label></div><div className="mt-4 space-y-2 border-t border-stone-100 pt-3 text-xs"><div className="flex justify-between"><span>Items subtotal</span><strong>{money(subtotal)}</strong></div><div className="flex justify-between"><span>Discount</span><strong>−{money(computedDiscount)}</strong></div><div className="flex justify-between"><span>Tax + Delivery</span><strong>{money(taxAmount + shippingFee)}</strong></div><div className="flex justify-between border-t border-stone-200 pt-3 text-base font-black"><span>Grand total</span><span>{money(total)}</span></div><div className="flex justify-between text-[#176b52]"><span>Due after advance</span><strong>{money(Math.max(0, total - advanceAmount))}</strong></div></div></section>

        <section className="rounded-lg border border-stone-200 p-4"><h3 className="text-sm font-extrabold">Activity log</h3><div className="mt-2 space-y-2">{order.activityLog?.length ? [...order.activityLog].reverse().slice(0, 12).map((entry, index) => <div key={`${entry.createdAt}-${index}`} className="border-l-2 border-[#b8d8c8] pl-2.5"><p className="text-[11px] font-semibold">{entry.action} · {entry.actor}</p><p className="mt-0.5 text-[10px] text-stone-500">{entry.details} · {new Date(entry.createdAt).toLocaleString('bn-BD')}</p></div>) : <p className="py-3 text-xs text-stone-500">এখনো কোনো audit history নেই।</p>}</div></section>

        </fieldset>
      </div>
    </div>
    </div>
    <footer className="z-20 grid shrink-0 gap-3 border-t border-stone-200 bg-white px-4 py-3 shadow-[0_-4px_12px_rgba(0,0,0,0.04)] sm:flex sm:items-center sm:justify-between sm:px-6 lg:px-8">
      <div className="min-w-0 flex-1">{error && <p role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">{error}</p>}{notice && <p role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">{notice}</p>}</div>
      <button type="button" onClick={() => void saveChanges()} disabled={isAbandonedCart || busy === 'save'} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#176b52] px-5 text-sm font-bold text-white transition hover:bg-[#125841] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto">{busy === 'save' ? <LoaderCircle className="size-4 animate-spin" /> : <Save className="size-4" />}{isAbandonedCart ? 'Convert cart to order before saving' : busy === 'save' ? 'সংরক্ষণ হচ্ছে...' : 'অর্ডার পরিবর্তন সংরক্ষণ'}</button>
    </footer>
    <div className="hidden print:block print:p-8"><h1>Order #{order._id}</h1><p>{getCustomerName(order)} · {getCustomerPhone(order)}</p><p>{delivery.address}</p><OrderBarcode value={barcodeValue} className="mt-5 h-16 w-64" /></div>
  </section></div>, document.body);
}