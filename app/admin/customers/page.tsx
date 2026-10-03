'use client';

import { useEffect, useMemo, useState } from 'react';
import { getCustomerName, getCustomerPhone, getOrderAddress } from '@/lib/order-format';

type Order = {
  _id: string;
  customerName?: string;
  name?: string;
  customerPhone?: string;
  phone?: string;
  customerAddress?: string;
  address?: string;
  shippingAddress?: string;
  userEmail?: string;
  email?: string;
  totalAmount?: number;
  createdAt: string;
};

type Customer = { key: string; name: string; phone: string; email: string; address: string; orderCount: number; spent: number; lastOrderAt: string };

export default function AdminCustomersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let mounted = true;
    fetch('/api/orders')
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.error || 'কাস্টমার লোড করা যায়নি।');
        if (mounted) setOrders(result.data);
      })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'কাস্টমার লোড করা যায়নি।'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  const customers = useMemo(() => {
    const grouped = new Map<string, Customer>();
    for (const order of orders) {
      const phone = getCustomerPhone(order);
      const name = getCustomerName(order);
      const key = phone || name.toLocaleLowerCase() || `order:${order._id}`;
      const customer = grouped.get(key);
      if (customer) {
        customer.orderCount += 1;
        customer.spent += Number(order.totalAmount || 0);
        if (new Date(order.createdAt).getTime() > new Date(customer.lastOrderAt).getTime()) customer.lastOrderAt = order.createdAt;
        if (!customer.address) customer.address = getOrderAddress(order);
        if (!customer.email) customer.email = order.userEmail || order.email || '';
      } else {
        grouped.set(key, { key, name: name || 'নাম উল্লেখ নেই', phone, email: order.userEmail || order.email || '', address: getOrderAddress(order), orderCount: 1, spent: Number(order.totalAmount || 0), lastOrderAt: order.createdAt });
      }
    }
    return [...grouped.values()].sort((a, b) => new Date(b.lastOrderAt).getTime() - new Date(a.lastOrderAt).getTime());
  }, [orders]);

  const visibleCustomers = customers.filter((customer) => `${customer.name} ${customer.phone} ${customer.email} ${customer.address}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));

  return <div>
    <div className="mb-6"><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#dc2626]">Relationships</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">কাস্টমার</h1><p className="mt-1 text-sm text-stone-500">অর্ডার করা কাস্টমারদের যোগাযোগ ও ক্রয় সারাংশ।</p></div>
    {error && <p role="alert" className="mb-4 border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    <div className="mb-4 grid gap-3 sm:grid-cols-2"><div className="border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">মোট কাস্টমার</p><p className="mt-2 text-2xl font-black">{loading ? '—' : new Intl.NumberFormat('bn-BD').format(customers.length)}</p></div><div className="border border-stone-200 bg-white p-4"><p className="text-xs font-bold uppercase tracking-wide text-stone-500">মোট অর্ডার</p><p className="mt-2 text-2xl font-black">{loading ? '—' : new Intl.NumberFormat('bn-BD').format(orders.length)}</p></div></div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h2 className="font-extrabold">কাস্টমার তালিকা</h2><label className="sr-only" htmlFor="customer-search">কাস্টমার খুঁজুন</label><input id="customer-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="নাম, ফোন বা ইমেইল দিয়ে খুঁজুন" className="h-10 w-full max-w-sm border border-stone-300 bg-white px-3 text-sm outline-none focus:border-[#dc2626]" /></div>
    {loading ? <div className="border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">কাস্টমার লোড হচ্ছে...</div> : visibleCustomers.length === 0 ? <div className="border border-stone-200 bg-white p-10 text-center text-sm text-stone-500">কোনো কাস্টমার পাওয়া যায়নি।</div> : <div className="overflow-x-auto border border-stone-200 bg-white"><table className="w-full min-w-220 text-left text-sm"><thead className="border-b border-stone-200 bg-stone-50 text-[11px] font-bold uppercase tracking-wide text-stone-500"><tr><th className="px-4 py-3">কাস্টমার</th><th className="px-4 py-3">যোগাযোগ</th><th className="px-4 py-3">সর্বশেষ ঠিকানা</th><th className="px-4 py-3">অর্ডার</th><th className="px-4 py-3">মোট ক্রয়</th><th className="px-4 py-3">সর্বশেষ অর্ডার</th></tr></thead><tbody className="divide-y divide-stone-100">{visibleCustomers.map((customer) => <tr key={customer.key} className="align-top hover:bg-stone-50"><td className="px-4 py-4 font-bold">{customer.name}</td><td className="px-4 py-4"><p className="font-semibold text-[#dc2626]">{customer.phone || 'ফোন পাওয়া যায়নি'}</p><p className="mt-1 text-xs text-stone-500">{customer.email || 'ইমেইল নেই'}</p></td><td className="max-w-xs whitespace-normal px-4 py-4 text-xs leading-5 text-stone-500">{customer.address || 'ঠিকানা নেই'}</td><td className="px-4 py-4">{new Intl.NumberFormat('bn-BD').format(customer.orderCount)}</td><td className="whitespace-nowrap px-4 py-4 font-bold">৳{new Intl.NumberFormat('bn-BD').format(customer.spent)}</td><td className="whitespace-nowrap px-4 py-4 text-xs text-stone-500">{new Date(customer.lastOrderAt).toLocaleDateString('bn-BD')}</td></tr>)}</tbody></table></div>}
  </div>;
}