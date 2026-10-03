'use client';

import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { CircleDollarSign, Plus, X } from 'lucide-react';

type Category = { _id: string; name: string };
type Expense = { _id: string; categoryName: string; amount: number; date: string; note: string };
type AccountingData = { categories: Category[]; expenses: Expense[]; income: number; expense: number; netBalance: number };
type RangeKey = 'today' | 'yesterday' | '7d' | 'custom';
const money = (amount: number) => `৳${new Intl.NumberFormat('en-US').format(amount || 0)}`;
const field = 'h-11 w-full rounded-lg border border-stone-300 bg-white px-3 text-sm outline-none focus:border-teal-700';
const dateString = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function AccountingManagement() {
  const [data, setData] = useState<AccountingData | null>(null);
  const [range, setRange] = useState<RangeKey>('7d');
  const [start, setStart] = useState(() => dateString(new Date(Date.now() - 6 * 86_400_000)));
  const [end, setEnd] = useState(() => dateString(new Date()));
  const [modal, setModal] = useState<'expense' | 'category' | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [expenseForm, setExpenseForm] = useState({ categoryId: '', amount: '', date: dateString(new Date()), note: '' });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    try {
      let from = start, to = end;
      const now = new Date();
      if (range === 'today') from = to = dateString(now);
      if (range === 'yesterday') from = to = dateString(new Date(now.getTime() - 86_400_000));
      if (range === '7d') { from = dateString(new Date(now.getTime() - 6 * 86_400_000)); to = dateString(now); }
      const response = await fetch(`/api/admin/tools/accounting?start=${from}&end=${to}`, { cache: 'no-store' });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'হিসাব লোড করা যায়নি।');
      setError('');
      setData(result.data);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'হিসাব লোড করা যায়নি।');
    } finally { setLoading(false); }
  }, [end, range, start]);
  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const addCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/tools/accounting/categories', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: categoryName }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'ক্যাটাগরি যোগ করা যায়নি।');
      setCategoryName(''); setModal(null); setNotice('Expense category added'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'ক্যাটাগরি যোগ করা যায়নি।'); }
    finally { setBusy(false); }
  };

  const addExpense = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/tools/accounting/expenses', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...expenseForm, amount: Number(expenseForm.amount) }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.error || 'খরচ যোগ করা যায়নি।');
      setModal(null); setNotice('Expense saved'); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'খরচ যোগ করা যায়নি।'); }
    finally { setBusy(false); }
  };

  return <main className="max-w-7xl">
    <header className="mb-6 flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-teal-700">Finance</p><h1 className="mt-1 text-2xl font-black sm:text-3xl">Accounting</h1><p className="mt-1 text-sm text-stone-600">Delivered-order income less recorded expenses for your selected period.</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => setModal('category')} className="inline-flex h-10 items-center gap-2 rounded-lg border border-stone-300 bg-white px-3 text-sm font-bold"><Plus className="size-4" />Expense category</button><button type="button" onClick={() => setModal('expense')} className="inline-flex h-10 items-center gap-2 rounded-lg bg-teal-800 px-3 text-sm font-bold text-white"><Plus className="size-4" />Add expense</button></div></header>
    {error && <p role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    {notice && <p role="status" className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{notice}</p>}
    <div className="mb-5 flex flex-wrap items-center gap-2">{(['yesterday', 'today', '7d', 'custom'] as RangeKey[]).map((key) => <button key={key} type="button" onClick={() => setRange(key)} className={`rounded-lg px-3 py-2 text-xs font-bold capitalize ${range === key ? 'bg-teal-800 text-white' : 'bg-white text-stone-600 ring-1 ring-stone-200'}`}>{key === '7d' ? 'Last 7 days' : key}</button>)}{range === 'custom' && <><input aria-label="Start date" type="date" value={start} onChange={(event) => setStart(event.target.value)} className={field} /><input aria-label="End date" type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={field} /></>}</div>
    <div className="grid gap-4 md:grid-cols-3">{[['Total Income', data?.income, 'text-emerald-700'], ['Total Expense', data?.expense, 'text-red-700'], ['Net Balance', data?.netBalance, 'text-teal-800']].map(([label, amount, color]) => <article key={String(label)} className="rounded-xl border border-stone-200 bg-white p-5"><p className="flex items-center gap-2 text-xs font-bold text-stone-500"><CircleDollarSign className="size-4" />{label}</p><strong className={`mt-3 block text-2xl font-black ${color}`}>{loading ? '…' : money(Number(amount || 0))}</strong></article>)}</div>
    <section className="mt-5 overflow-hidden rounded-xl border border-stone-200 bg-white"><header className="border-b border-stone-200 p-4"><h2 className="font-extrabold">Recorded expenses</h2><p className="mt-1 text-xs text-stone-500">Income is based on delivered/partially delivered orders; expense totals include every matching record.</p></header><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-stone-50 text-xs font-bold text-stone-500"><tr>{['Category', 'Amount', 'Date', 'Note'].map((item) => <th key={item} className="px-4 py-3">{item}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{data?.expenses.map((expense) => <tr key={expense._id}><td className="px-4 py-3 font-semibold">{expense.categoryName}</td><td className="px-4 py-3 font-bold">{money(expense.amount)}</td><td className="px-4 py-3">{new Date(expense.date).toLocaleDateString()}</td><td className="px-4 py-3 text-stone-500">{expense.note || '—'}</td></tr>)}</tbody></table></div>{!data?.expenses.length && <p className="p-8 text-center text-sm text-stone-500">এই সময়সীমায় কোনো খরচ নেই।</p>}</section>
    {modal && <div role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }} className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4"><section role="dialog" aria-modal="true" aria-labelledby="accounting-modal-title" className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl sm:p-7"><div className="mb-5 flex items-center justify-between"><h2 id="accounting-modal-title" className="text-lg font-black">{modal === 'category' ? 'Add expense category' : 'Add expense'}</h2><button type="button" onClick={() => setModal(null)} aria-label="Close" className="grid size-9 place-items-center rounded-lg hover:bg-stone-100"><X className="size-5" /></button></div>{modal === 'category' ? <form onSubmit={addCategory} className="space-y-4"><label className="block text-sm font-semibold">Category name<input required maxLength={80} value={categoryName} onChange={(event) => setCategoryName(event.target.value)} placeholder="Office Rent" className={`${field} mt-1`} /></label><button disabled={busy} className="min-h-11 w-full rounded-lg bg-teal-800 font-bold text-white disabled:opacity-50">Save category</button></form> : <form onSubmit={addExpense} className="space-y-4"><label className="block text-sm font-semibold">Expense category<select required value={expenseForm.categoryId} onChange={(event) => setExpenseForm({ ...expenseForm, categoryId: event.target.value })} className={`${field} mt-1`}><option value="">Select category</option>{data?.categories.map((category) => <option key={category._id} value={category._id}>{category.name}</option>)}</select></label><label className="block text-sm font-semibold">Amount<input required type="number" min="0.01" step="0.01" value={expenseForm.amount} onChange={(event) => setExpenseForm({ ...expenseForm, amount: event.target.value })} className={`${field} mt-1`} /></label><label className="block text-sm font-semibold">Date<input required type="date" max={dateString(new Date())} value={expenseForm.date} onChange={(event) => setExpenseForm({ ...expenseForm, date: event.target.value })} className={`${field} mt-1`} /></label><label className="block text-sm font-semibold">Note (optional)<textarea maxLength={1000} rows={3} value={expenseForm.note} onChange={(event) => setExpenseForm({ ...expenseForm, note: event.target.value })} className={`${field} mt-1 h-auto py-2`} /></label><button disabled={busy || !data?.categories.length} className="min-h-11 w-full rounded-lg bg-teal-800 font-bold text-white disabled:opacity-50">Save expense</button>{!data?.categories.length && <p className="text-xs text-amber-800">Add an expense category first.</p>}</form>}</section></div>}
  </main>;
}
