'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Barcode, Camera, Check, CircleDollarSign, FileSpreadsheet, LoaderCircle, Plus, Save, ScanLine, Trash2 } from 'lucide-react';

const courierNames = ['Steadfast', 'Pathao', 'RedX', 'Carrybee'] as const;
const deliveryStatuses = ['All Payment', 'Pending', 'In Transit', 'Delivered', 'Partial Delivered', 'Returned', 'Cancelled', 'Lost'];
type Courier = (typeof courierNames)[number];
type Zone = { name: string; fee: number };
type CourierConfig = { configured: boolean; baseApiUrl: string; storeId: string; zones: Zone[] };
type AdminOrder = {
  _id: string; customerName: string; customerPhone: string; courierName: string; courierStatus: string;
  trackingId: string; status: string; totalAmount: number; courierCollectedAmount: number;
  courierPaymentStatus: 'Paid' | 'Unpaid'; createdAt: string;
};
type Data = { couriers: Record<Courier, CourierConfig>; orders: AdminOrder[]; payments: { total: number; paid: number; unpaid: number } };
type Editor = { apiKey: string; secretKey: string; webhookToken: string; storeId: string; baseApiUrl: string; zones: Zone[] };
type DetectedBarcode = { rawValue: string };
type BarcodeDetectorReader = { detect(source: HTMLVideoElement): Promise<DetectedBarcode[]> };
type BarcodeDetectorFactory = {
  new(options: { formats: string[] }): BarcodeDetectorReader;
  getSupportedFormats(): Promise<string[]>;
};
const blankEditor = (): Editor => ({ apiKey: '', secretKey: '', webhookToken: '', storeId: '', baseApiUrl: '', zones: [] });
const money = (value: number) => `৳${new Intl.NumberFormat('en-US').format(value || 0)}`;
const field = 'h-10 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-700';

export default function CourierManagement() {
  const [data, setData] = useState<Data | null>(null);
  const [courier, setCourier] = useState<Courier>('Steadfast');
  const [editor, setEditor] = useState<Editor>(blankEditor());
  const [direction, setDirection] = useState<'shipping' | 'return'>('shipping');
  const [scanCode, setScanCode] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Payment');
  const [paymentFilter, setPaymentFilter] = useState<'all' | 'Paid' | 'Unpaid'>('all');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/tools/courier', { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'কুরিয়ার তথ্য লোড করা যায়নি।');
      setError('');
      setData(result.data);
      const config = result.data.couriers[courier] as CourierConfig;
      setEditor((current) => ({ ...current, baseApiUrl: config.baseApiUrl, storeId: config.storeId, zones: config.zones }));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'কুরিয়ার তথ্য লোড করা যায়নি।');
    } finally {
      setLoading(false);
    }
  }, [courier]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  useEffect(() => {
    if (!cameraActive) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer = 0;
    const videoElement = videoRef.current;
    const startCamera = async () => {
      const Detector = (window as Window & { BarcodeDetector?: BarcodeDetectorFactory }).BarcodeDetector;
      if (!Detector) {
        setError('এই ব্রাউজারে camera barcode/QR scanning সমর্থিত নয়। barcode scanner অথবা order number ব্যবহার করুন।');
        setCameraActive(false);
        return;
      }
      try {
        const supported = await Detector.getSupportedFormats();
        const formats = ['qr_code', 'code_128', 'ean_13', 'ean_8', 'upc_a', 'upc_e'].filter((format) => supported.includes(format));
        if (!formats.length) throw new Error('এই ব্রাউজার barcode/QR format সমর্থন করে না।');
        const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (cancelled) { media.getTracks().forEach((track) => track.stop()); return; }
        stream = media;
        const video = videoElement;
        if (!video) throw new Error('ক্যামেরা চালু করা যায়নি।');
        video.srcObject = media;
        await video.play();
        const detector = new Detector({ formats });
        const detect = async () => {
          if (cancelled) return;
          try {
            const [barcode] = await detector.detect(video);
            if (barcode?.rawValue) {
              setScanCode(barcode.rawValue);
              setCameraActive(false);
              return;
            }
            timer = window.setTimeout(() => { void detect(); }, 250);
          } catch {
            if (!cancelled) {
              setError('ক্যামেরা থেকে barcode/QR পড়া যায়নি। barcode scanner অথবা order number ব্যবহার করুন।');
              setCameraActive(false);
            }
          }
        };
        void detect();
      } catch (reason) {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : 'ক্যামেরা চালু করা যায়নি। HTTPS camera permission পরীক্ষা করুন।');
          setCameraActive(false);
        }
      }
    };
    void startCamera();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      stream?.getTracks().forEach((track) => track.stop());
      if (videoElement) videoElement.srcObject = null;
    };
  }, [cameraActive]);

  const visibleOrders = useMemo(() => (data?.orders || []).filter((order) => {
    const matchesStatus = statusFilter === 'All Payment' || order.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || order.courierPaymentStatus === paymentFilter;
    return matchesStatus && matchesPayment;
  }), [data, paymentFilter, statusFilter]);

  const updateEditor = (key: keyof Editor, value: string | Zone[]) => setEditor((current) => ({ ...current, [key]: value }));
  const selectCourier = (value: Courier) => {
    setCourier(value);
    const config = data?.couriers[value];
    setEditor({ ...blankEditor(), baseApiUrl: config?.baseApiUrl || '', storeId: config?.storeId || '', zones: config?.zones || [] });
  };

  const saveSettings = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const response = await fetch('/api/admin/tools/courier', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier, ...editor }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'কুরিয়ার সেটিংস সেভ করা যায়নি।');
      setNotice(`${courier} settings saved`);
      setEditor((current) => ({ ...current, apiKey: '', secretKey: '', webhookToken: '' }));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'কুরিয়ার সেটিংস সেভ করা যায়নি।');
    } finally { setBusy(false); }
  };

  const scan = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!scanCode.trim()) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch('/api/admin/tools/courier/scan', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier, code: scanCode.trim(), direction }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'স্ক্যান আপডেট করা যায়নি।');
      setNotice(`${result.data.customerName} · ${result.data.status}`);
      setScanCode('');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'স্ক্যান আপডেট করা যায়নি।');
    } finally { setBusy(false); }
  };

  const importReport = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true); setError(''); setNotice('');
    try {
      const body = new FormData();
      body.set('courier', courier);
      body.set('file', file);
      const response = await fetch('/api/admin/tools/courier/import', { method: 'POST', body });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'রিপোর্ট ইমপোর্ট করা যায়নি।');
      const errorDetails = (result.data.errors as string[]).slice(0, 5).join(' ');
      setNotice(`${result.data.updated} rows updated · ${result.data.errorCount} rows skipped${errorDetails ? ` · ${errorDetails}` : ''}`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'রিপোর্ট ইমপোর্ট করা যায়নি।');
    } finally { setBusy(false); }
  };

  const updatePayment = async (order: AdminOrder, paymentStatus: 'Paid' | 'Unpaid') => {
    setBusy(true); setError('');
    try {
      const response = await fetch(`/api/admin/tools/courier/orders/${order._id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ courierPaymentStatus: paymentStatus }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'পেমেন্ট আপডেট করা যায়নি।');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'পেমেন্ট আপডেট করা যায়নি।');
    } finally { setBusy(false); }
  };

  const clearCredentials = async () => {
    if (!window.confirm(`Remove saved ${courier} credentials?`)) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/tools/courier', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ courier, clearCredentials: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'Saved credentials could not be removed.');
      setNotice(`${courier} credentials removed`);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Saved credentials could not be removed.');
    } finally { setBusy(false); }
  };

  const zones = editor.zones;
  return <main className="max-w-7xl">
    <header className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Delivery operations</p><h1 className="mt-1 text-2xl font-black text-stone-900 sm:text-3xl">Courier Management</h1><p className="mt-1 text-sm text-stone-600">Courier connection, dispatch scanning, payments and report imports.</p></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    {loading ? <div className="border border-stone-200 bg-white p-8 text-sm text-stone-500">কুরিয়ার তথ্য লোড হচ্ছে...</div> : <>
      <div className="mb-5 grid gap-3 sm:grid-cols-3">{[
        ['All Payment', data?.payments.total], ['Paid', data?.payments.paid], ['Unpaid', data?.payments.unpaid],
      ].map(([label, amount]) => <button key={String(label)} type="button" onClick={() => setPaymentFilter(label === 'All Payment' ? 'all' : label as 'Paid' | 'Unpaid')} className={`rounded-xl border p-4 text-left ${paymentFilter === (label === 'All Payment' ? 'all' : label) ? 'border-teal-700 bg-teal-50' : 'border-stone-200 bg-white'}`}><span className="flex items-center gap-2 text-xs font-bold text-stone-500"><CircleDollarSign className="size-4" />{label}</span><strong className="mt-2 block text-xl text-stone-900">{money(Number(amount || 0))}</strong></button>)}</div>
      <div className="grid gap-5 xl:grid-cols-[1fr_1.1fr]">
        <form onSubmit={saveSettings} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Courier API & delivery zones</h2><p className="mt-1 text-xs text-stone-500">Credentials are encrypted on the server and never returned to the browser.</p></div><select value={courier} onChange={(event) => selectCourier(event.target.value as Courier)} className={field}>{courierNames.map((name) => <option key={name}>{name}</option>)}</select></div>
          <div className="grid gap-3 sm:grid-cols-2">{([
            ['apiKey', 'API Key'], ['secretKey', 'Secret Key'], ['webhookToken', 'Webhook Token'], ['storeId', 'Store ID'], ['baseApiUrl', 'Base API URL'],
          ] as const).map(([key, label]) => <label key={key} className={`text-xs font-bold text-stone-700 ${key === 'baseApiUrl' ? 'sm:col-span-2' : ''}`}>{label}<input type={['apiKey', 'secretKey', 'webhookToken'].includes(key) ? 'password' : 'text'} value={editor[key]} onChange={(event) => setEditor((current) => ({ ...current, [key]: event.target.value }))} placeholder={['apiKey', 'secretKey', 'webhookToken'].includes(key) && data?.couriers[courier]?.configured ? 'Saved securely — leave blank to keep' : ''} className={`${field} mt-1`} /></label>)}</div>
          <div><div className="mb-2 flex items-center justify-between"><h3 className="text-sm font-bold">Delivery fees by zone</h3><button type="button" onClick={() => updateEditor('zones', [...zones, { name: '', fee: 0 }])} className="inline-flex items-center gap-1 text-xs font-bold text-teal-800"><Plus className="size-4" />Add zone</button></div><div className="space-y-2">{zones.map((zone, index) => <div key={`zone-${index}`} className="grid grid-cols-[1fr_7rem_2.5rem] gap-2"><input aria-label="Zone name" value={zone.name} onChange={(event) => updateEditor('zones', zones.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item))} placeholder="Inside City" className={field} /><input aria-label="Delivery fee" type="number" min="0" value={zone.fee} onChange={(event) => updateEditor('zones', zones.map((item, itemIndex) => itemIndex === index ? { ...item, fee: Number(event.target.value) } : item))} className={field} /><button type="button" aria-label="Remove zone" onClick={() => updateEditor('zones', zones.filter((_, itemIndex) => itemIndex !== index))} className="grid place-items-center rounded-lg text-red-600 hover:bg-red-50"><Trash2 className="size-4" /></button></div>)}</div></div>
          <div className="flex flex-wrap gap-2"><button disabled={busy} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-bold text-white disabled:opacity-50"><Save className="size-4" />Save Courier Settings</button>{data?.couriers[courier]?.configured && <button type="button" disabled={busy} onClick={() => void clearCredentials()} className="min-h-10 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-700 disabled:opacity-50">Forget saved credentials</button>}</div>
        </form>
        <div className="space-y-4">
          <form onSubmit={scan} className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><div className="mb-4 flex items-center gap-2"><ScanLine className="size-5 text-teal-800" /><h2 className="font-extrabold">Scan to update shipment</h2></div><div className="grid gap-3 sm:grid-cols-[1fr_1fr]"><select aria-label="Courier" value={courier} onChange={(event) => selectCourier(event.target.value as Courier)} className={field}>{courierNames.map((name) => <option key={name}>{name}</option>)}</select><select aria-label="Scan action" value={direction} onChange={(event) => setDirection(event.target.value as 'shipping' | 'return')} className={field}><option value="shipping">Shipping · In Transit</option><option value="return">Return</option></select></div><div className="mt-3 flex gap-2"><input autoComplete="off" autoFocus aria-label="Barcode, tracking ID or invoice number" value={scanCode} onChange={(event) => setScanCode(event.target.value)} placeholder="Scan or type order / tracking number" className={field} /><button disabled={busy || !scanCode.trim()} className="grid size-10 shrink-0 place-items-center rounded-lg bg-teal-800 text-white disabled:opacity-50">{busy ? <LoaderCircle className="size-4 animate-spin" /> : <Barcode className="size-5" />}</button></div>{cameraActive ? <div className="mt-3"><video ref={videoRef} muted playsInline className="max-h-64 w-full rounded-lg bg-black object-contain" /><button type="button" onClick={() => setCameraActive(false)} className="mt-2 text-xs font-bold text-red-700">Stop camera</button></div> : <button type="button" onClick={() => { setError(''); setCameraActive(true); }} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-teal-800"><Camera className="size-4" />Scan with camera</button>}</form>
          <div className="rounded-2xl border border-stone-200 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-extrabold">Import courier invoice</h2><p className="mt-1 text-xs text-stone-500">Match report rows using invoice / order ID or tracking ID; update status and settlement.</p></div><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-lg border border-stone-300 px-3 text-xs font-bold hover:bg-stone-50"><FileSpreadsheet className="size-4" />Choose report<input type="file" accept=".csv,.xls,.xlsx" onChange={(event) => { void importReport(event.target.files?.[0]); event.currentTarget.value = ''; }} className="sr-only" /></label></div></div>
        </div>
      </div>
      <section className="mt-5 overflow-hidden rounded-2xl border border-stone-200 bg-white">
        <div className="flex flex-wrap gap-2 overflow-x-auto border-b border-stone-200 p-3">{deliveryStatuses.map((status) => <button key={status} type="button" onClick={() => setStatusFilter(status)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold ${statusFilter === status ? 'bg-teal-800 text-white' : 'bg-stone-100 text-stone-600'}`}>{status}</button>)}</div>
        <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-stone-50 text-[11px] font-bold uppercase text-stone-500"><tr>{['Order / customer', 'Courier / tracking', 'Status', 'Collected', 'Payment', 'Updated'].map((title) => <th key={title} className="px-4 py-3">{title}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{visibleOrders.map((order) => <tr key={order._id} className="hover:bg-stone-50"><td className="px-4 py-3"><strong className="block">#{order._id.slice(-8).toUpperCase()}</strong><span className="text-xs text-stone-500">{order.customerName} · {order.customerPhone}</span></td><td className="px-4 py-3">{order.courierName || '—'}<span className="block text-xs text-stone-500">{order.trackingId || 'No tracking ID'}</span></td><td className="px-4 py-3">{order.status}</td><td className="px-4 py-3 font-bold">{money(order.courierCollectedAmount)}</td><td className="px-4 py-3"><button disabled={busy} type="button" onClick={() => void updatePayment(order, order.courierPaymentStatus === 'Paid' ? 'Unpaid' : 'Paid')} className={`rounded-full px-2.5 py-1 text-xs font-bold ${order.courierPaymentStatus === 'Paid' ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800'}`}>{order.courierPaymentStatus === 'Paid' ? <><Check className="mr-1 inline size-3" />Paid</> : 'Unpaid'}</button></td><td className="px-4 py-3 text-xs text-stone-500">{new Date(order.createdAt).toLocaleDateString()}</td></tr>)}</tbody></table></div>
        {!visibleOrders.length && <p className="p-8 text-center text-sm text-stone-500">কোনো কুরিয়ার অর্ডার পাওয়া যায়নি।</p>}
      </section>
    </>}
  </main>;
}
