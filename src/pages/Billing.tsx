import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import apiClient from '../api/client';

type PaymentItem = {
  id: string;
  label: string;
  amount: string;
  status: string;
  date: string;
  source?: string;
  type?: 'credit' | 'debit';
};

type DashboardResponse = {
  summary?: {
    accountBalance: number;
  };
  payments: PaymentItem[];
  cases: Array<{
    id: string;
    title: string;
    status: string;
    nextStep: string;
  }>;
};

type TopUpMethod = {
  id: string;
  label: string;
  detail: string;
  icon: string;
};

type TransactionFilter = 'all' | 'pending' | 'paid' | 'credit';

const PRESET_AMOUNTS = [25000, 50000, 100000, 250000];

const PAYMENT_METHODS: TopUpMethod[] = [
  { id: 'zain-cash', label: 'زين كاش', detail: 'محفظة رقمية', icon: 'fa-mobile-screen-button' },
  { id: 'qi-card', label: 'كي كارد', detail: 'بطاقة دفع محلية', icon: 'fa-credit-card' },
  { id: 'bank-transfer', label: 'تحويل مصرفي', detail: 'تحويل إلى الحساب', icon: 'fa-building-columns' },
];

function formatCurrency(amount: number) {
  return `${amount.toLocaleString('ar-IQ')} د.ع`;
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^\d.]/g, '');
  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

export default function Billing() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [customAmount, setCustomAmount] = useState('');
  const [selectedMethodId, setSelectedMethodId] = useState(PAYMENT_METHODS[0].id);
  const [transactionFilter, setTransactionFilter] = useState<TransactionFilter>('all');
  const [transactionSearch, setTransactionSearch] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingBalance, setIsAddingBalance] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      try {
        const response = await apiClient.getDashboard();
        setDashboard(response.data);
      } catch (error) {
        console.error('Failed to load billing data', error);
        setFeedback({ type: 'error', message: 'تعذر تحميل بيانات المدفوعات حالياً.' });
      } finally {
        setIsLoading(false);
      }
    };

    load();
  }, []);

  const availableBalance = dashboard?.summary?.accountBalance ?? 0;
  const amountToUse = customAmount.trim() ? parseAmount(customAmount) : selectedAmount;
  const selectedMethod = PAYMENT_METHODS.find((method) => method.id === selectedMethodId) || PAYMENT_METHODS[0];
  const pendingPayments = useMemo(
    () => (dashboard?.payments || []).filter((item) => item.status !== 'مدفوع'),
    [dashboard?.payments],
  );
  const creditTransactions = useMemo(
    () => (dashboard?.payments || []).filter((item) => item.type === 'credit' || item.label.includes('رصيد')),
    [dashboard?.payments],
  );
  const totalPendingAmount = useMemo(
    () => pendingPayments.reduce((total, item) => total + parseAmount(item.amount), 0),
    [pendingPayments],
  );
  const recentCreditAmount = useMemo(
    () => creditTransactions.reduce((total, item) => total + parseAmount(item.amount), 0),
    [creditTransactions],
  );
  const filteredTransactions = useMemo(() => {
    const normalizedQuery = transactionSearch.trim().toLowerCase();

    return (dashboard?.payments || []).filter((item) => {
      const matchesFilter =
        transactionFilter === 'all' ||
        (transactionFilter === 'pending' && item.status !== 'مدفوع') ||
        (transactionFilter === 'paid' && item.status === 'مدفوع') ||
        (transactionFilter === 'credit' && (item.type === 'credit' || item.label.includes('رصيد')));
      const matchesSearch =
        normalizedQuery.length === 0 ||
        item.label.toLowerCase().includes(normalizedQuery) ||
        item.amount.toLowerCase().includes(normalizedQuery) ||
        item.status.toLowerCase().includes(normalizedQuery) ||
        (item.source || '').toLowerCase().includes(normalizedQuery);

      return matchesFilter && matchesSearch;
    });
  }, [dashboard?.payments, transactionFilter, transactionSearch]);
  const isAmountValid = amountToUse >= 5000 && amountToUse <= 1000000;
  const walletTarget = Math.max(250000, totalPendingAmount + 100000);
  const walletCoverage = Math.min(100, Math.round((availableBalance / walletTarget) * 100));

  const handleAddBalance = async () => {
    if (!isAmountValid || isAddingBalance) {
      setFeedback({ type: 'error', message: 'اختر مبلغاً بين 5,000 و 1,000,000 د.ع.' });
      return;
    }

    setIsAddingBalance(true);
    setFeedback(null);

    try {
      const response = await apiClient.addCreditBalance({
        amount: amountToUse,
        paymentMethod: selectedMethod.label,
        note: note.trim() || undefined,
      });

      const data = response.data;
      setDashboard((current) => {
        if (!current) return current;
        return {
          ...current,
          summary: {
            ...(current.summary || { accountBalance: 0 }),
            accountBalance: data.balance,
          },
          payments: [data.transaction, ...(current.payments || [])],
        };
      });
      setNote('');
      setCustomAmount('');
      setSelectedAmount(PRESET_AMOUNTS[1]);
      setFeedback({ type: 'success', message: response.message || 'تمت إضافة الرصيد إلى محفظتك.' });
    } catch (error: any) {
      setFeedback({
        type: 'error',
        message: error?.response?.data?.error || 'فشل إضافة الرصيد. حاول مرة أخرى.',
      });
    } finally {
      setIsAddingBalance(false);
    }
  };

  return (
    <div className="app-view fade-in mx-auto max-w-[1400px] space-y-6 pb-12 text-right">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/80 shadow-premium backdrop-blur">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
              <i className="fa-solid fa-receipt"></i>
              Billing Center
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-brand-dark md:text-4xl">المحفظة والمدفوعات في لوحة واحدة</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              راقب الرصيد، سدّد المستحقات، وأضف رصيداً جديداً مع سجل معاملات قابل للبحث والفلترة.
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">المستحق الآن</p>
                <p className="mt-2 text-2xl font-black text-brand-dark">{formatCurrency(totalPendingAmount)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{pendingPayments.length.toLocaleString('ar-IQ')} فاتورة معلقة</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">إضافات الرصيد</p>
                <p className="mt-2 text-2xl font-black text-brand-dark">{formatCurrency(recentCreditAmount)}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">{creditTransactions.length.toLocaleString('ar-IQ')} عملية</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">آخر تحديث</p>
                <p className="mt-2 truncate text-sm font-black text-brand-dark">{dashboard?.payments?.[0]?.date || 'لا توجد معاملات'}</p>
                <p className="mt-1 text-xs font-bold text-slate-500">سجل المدفوعات</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden bg-[linear-gradient(135deg,#0B132B,#1A237E)] p-6 text-white md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
                <i className="fa-solid fa-wallet text-xl"></i>
              </div>
              <div>
                <p className="text-sm font-black text-blue-200">الرصيد المتاح</p>
                <p className="mt-3 text-4xl font-black">
                  {isLoading ? '...' : availableBalance.toLocaleString('ar-IQ')} <span className="text-base text-brand-gold">د.ع</span>
                </p>
                <p className="mt-2 text-xs font-bold leading-6 text-blue-100">يمكن استخدامه لفتح الاستشارات أو تسوية الفواتير القادمة.</p>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-white/10 p-4">
              <div className="mb-2 flex items-center justify-between text-[11px] font-black text-blue-100">
                <span>{walletCoverage}%</span>
                <span>جاهزية المحفظة</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15">
                <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${walletCoverage}%` }}></div>
              </div>
              <p className="mt-2 text-[11px] font-bold leading-5 text-blue-100">الهدف المقترح: {formatCurrency(walletTarget)}</p>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ActionButton
                onClick={() => document.getElementById('add-credit-balance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                variant="secondary"
                className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                <i className="fa-solid fa-plus"></i>
                إضافة رصيد
              </ActionButton>
              <ActionButton onClick={() => navigate('/cases', { state: { openNewCase: true } })} variant="secondary" className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                افتح قضية
              </ActionButton>
            </div>
          </div>
        </div>
      </section>

      {feedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm font-black ${feedback.type === 'success' ? 'border-emerald-100 bg-emerald-50 text-emerald-700' : 'border-red-100 bg-red-50 text-red-700'}`}>
          {feedback.message}
        </div>
      )}

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-5">
          <section id="add-credit-balance" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-black text-brand-dark">إضافة رصيد</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">اختر مبلغاً وطريقة دفع، ثم أضف الرصيد مباشرة إلى محفظتك.</p>
              </div>
              <span className="rounded-xl bg-emerald-50 px-3 py-2 text-[11px] font-black text-emerald-700">
                إضافة فورية
              </span>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              {PRESET_AMOUNTS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => {
                    setSelectedAmount(amount);
                    setCustomAmount('');
                  }}
                  className={`rounded-2xl border px-4 py-4 text-center text-sm font-black transition ${!customAmount && selectedAmount === amount ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/15' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-navy hover:bg-white'}`}
                >
                  {formatCurrency(amount)}
                </button>
              ))}
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-brand-navy/10 bg-brand-navy/[0.03] p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">اقتراح سريع</p>
                  <p className="mt-1 text-sm font-black text-brand-dark">أضف ما يكفي لتغطية المستحقات الحالية مع هامش للاستشارات.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAmount(walletTarget);
                    setCustomAmount(String(walletTarget));
                  }}
                  className="rounded-xl border border-brand-navy/10 bg-white px-4 py-2 text-xs font-black text-brand-navy shadow-sm transition hover:border-brand-navy"
                >
                  استخدام {formatCurrency(walletTarget)}
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">مبلغ مخصص</label>
                  <input
                    type="number"
                    min={5000}
                    max={1000000}
                    step={1000}
                    value={customAmount}
                    onChange={(event) => setCustomAmount(event.target.value)}
                    placeholder="أدخل مبلغاً بين 5,000 و 1,000,000"
                    className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none transition focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/5"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  {PAYMENT_METHODS.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => setSelectedMethodId(method.id)}
                      className={`rounded-2xl border p-4 text-right transition ${selectedMethodId === method.id ? 'border-brand-navy bg-brand-navy/5 shadow-sm ring-4 ring-brand-navy/5' : 'border-slate-200 bg-white hover:border-brand-navy/30'}`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className={`h-4 w-4 rounded-full border ${selectedMethodId === method.id ? 'border-brand-navy bg-brand-navy shadow-[inset_0_0_0_3px_white]' : 'border-slate-300 bg-white'}`}></span>
                        <i className={`fa-solid ${method.icon} text-lg text-brand-gold`}></i>
                      </div>
                      <p className="mt-3 text-sm font-black text-brand-dark">{method.label}</p>
                      <p className="mt-1 text-[10px] font-bold text-slate-400">{method.detail}</p>
                    </button>
                  ))}
                </div>

                <textarea
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="ملاحظة اختيارية للمعاملة"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/5"
                  rows={3}
                />
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">ملخص الإضافة</p>
                <p className="mt-4 text-3xl font-black text-brand-dark">{formatCurrency(amountToUse)}</p>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white">
                  <div className={`h-full rounded-full transition-all ${isAmountValid ? 'bg-emerald-500' : 'bg-red-400'}`} style={{ width: `${Math.min(100, Math.max(6, (amountToUse / 1000000) * 100))}%` }}></div>
                </div>
                <div className="mt-4 space-y-3 text-xs font-bold text-slate-500">
                  <div className="flex items-center justify-between gap-3">
                    <span>{selectedMethod.label}</span>
                    <span>طريقة الدفع</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>{formatCurrency(availableBalance + (isAmountValid ? amountToUse : 0))}</span>
                    <span>الرصيد بعد الإضافة</span>
                  </div>
                  <div className="rounded-xl bg-white px-3 py-3 text-right leading-6">
                    {isAmountValid ? 'سيتم تسجيل العملية كإضافة رصيد مكتملة في سجل المعاملات.' : 'أدخل مبلغاً صحيحاً للمتابعة.'}
                  </div>
                </div>
                <ActionButton
                  type="button"
                  onClick={handleAddBalance}
                  disabled={!isAmountValid || isAddingBalance}
                  variant="primary"
                  className="mt-5 w-full"
                >
                  {isAddingBalance ? (
                    <>
                      <i className="fa-solid fa-spinner fa-spin"></i>
                      جارٍ الإضافة
                    </>
                  ) : (
                    <>
                      <i className="fa-solid fa-circle-plus"></i>
                      إضافة الرصيد
                    </>
                  )}
                </ActionButton>
              </div>
            </div>
          </section>

          <section id="billing-transactions" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-brand-dark">المعاملات والفواتير</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">سجل واضح يساعدك على معرفة ما تم دفعه وما يزال معلقاً.</p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="relative">
                  <input
                    type="search"
                    value={transactionSearch}
                    onChange={(event) => setTransactionSearch(event.target.value)}
                    placeholder="ابحث في المعاملات..."
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 py-3 pl-4 pr-10 text-right text-xs font-bold text-slate-700 outline-none transition focus:border-brand-navy sm:w-64"
                  />
                  <i className="fa-solid fa-search absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                </div>
                <ActionButton
                  type="button"
                  onClick={() => document.getElementById('add-credit-balance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  variant="ghost"
                  size="sm"
                >
                  <i className="fa-solid fa-plus"></i>
                  إضافة
                </ActionButton>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {([
                { id: 'all', label: 'الكل', count: dashboard?.payments?.length || 0 },
                { id: 'pending', label: 'معلقة', count: pendingPayments.length },
                { id: 'paid', label: 'مدفوعة', count: (dashboard?.payments || []).filter((item) => item.status === 'مدفوع').length },
                { id: 'credit', label: 'رصيد', count: creditTransactions.length },
              ] as Array<{ id: TransactionFilter; label: string; count: number }>).map((filter) => (
                <button
                  key={filter.id}
                  type="button"
                  onClick={() => setTransactionFilter(filter.id)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${transactionFilter === filter.id ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy hover:bg-white hover:text-brand-navy'}`}
                >
                  {filter.label}
                  <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5">{filter.count.toLocaleString('ar-IQ')}</span>
                </button>
              ))}
            </div>

            {isLoading ? (
              <div className="mt-4 grid gap-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : filteredTransactions.length > 0 ? (
              <div className="mt-4 grid gap-3">
                {filteredTransactions.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 transition hover:border-brand-navy/30 hover:bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-xl px-3 py-1 text-[11px] font-black ${item.status === 'مدفوع' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {item.status}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-dark">{item.label}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{item.source || item.date}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-bold text-slate-400">{item.date}</p>
                      <p className={`text-sm font-black ${item.type === 'credit' ? 'text-emerald-600' : 'text-brand-dark'}`}>
                        {item.type === 'credit' ? '+' : ''}{item.amount}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (dashboard?.payments || []).length > 0 ? (
              <div className="mt-4 rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-300 shadow-sm">
                  <i className="fa-solid fa-filter-circle-xmark text-xl"></i>
                </div>
                <p className="text-sm font-black text-brand-dark">لا توجد معاملات مطابقة</p>
                <p className="mt-1 text-xs font-bold text-slate-500">غيّر البحث أو الفلتر لعرض معاملات أكثر.</p>
                <button
                  type="button"
                  onClick={() => { setTransactionSearch(''); setTransactionFilter('all'); }}
                  className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black text-brand-navy shadow-sm transition hover:border-brand-navy"
                >
                  مسح الفلاتر
                </button>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon="wallet"
                  title="لا توجد معاملات بعد"
                  description="ستظهر هنا الإضافات إلى الرصيد والفواتير والمدفوعات فور توفرها على الحساب."
                />
              </div>
            )}
          </section>
        </div>

        <aside className="space-y-4">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">المطلوب الآن</h2>
            <div className="mt-4 space-y-3">
              {pendingPayments.length > 0 ? (
                pendingPayments.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-amber-700">{item.status}</span>
                      <div>
                        <p className="text-sm font-black text-brand-dark">{item.label}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{item.source || item.date}</p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => document.getElementById('add-credit-balance')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="rounded-xl bg-brand-navy px-3 py-2 text-[10px] font-black text-white transition hover:bg-brand-dark"
                      >
                        إضافة رصيد
                      </button>
                      <p className="text-sm font-black text-amber-800">{item.amount}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-700">
                  لا توجد مدفوعات معلقة حالياً.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">نصائح سريعة</h2>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-brand-dark">احتفظ برصيد كافٍ</p>
                <p className="mt-1 text-xs font-bold leading-6 text-slate-500">رصيد المحفظة يقلل خطوات الدفع عند فتح استشارة جديدة.</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-sm font-black text-brand-dark">راجع المستحقات</p>
                <p className="mt-1 text-xs font-bold leading-6 text-slate-500">الفواتير المعلقة تظهر هنا قبل أي إجراء جديد.</p>
              </div>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">أسرع المسارات</h2>
            <div className="mt-4 grid gap-3">
              <ActionButton onClick={() => navigate('/cases', { state: { openNewCase: true } })} variant="primary" className="w-full">
                افتح قضية جديدة
              </ActionButton>
              <ActionButton onClick={() => navigate('/messages')} variant="secondary" className="w-full">
                افتح الرسائل
              </ActionButton>
              <ActionButton onClick={() => navigate('/lawyers')} variant="ghost" className="w-full">
                ابحث عن محامٍ
              </ActionButton>
            </div>
          </section>
        </aside>
      </section>
    </div>
  );
}
