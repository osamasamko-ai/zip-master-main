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
  const isAmountValid = amountToUse >= 5000 && amountToUse <= 1000000;

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
      <section className="rounded-[1.75rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-5 shadow-premium md:p-7">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex flex-col justify-between gap-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Billing</p>
              <h1 className="mt-3 text-3xl font-black text-brand-dark">المحفظة والمدفوعات</h1>
              <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
                أضف رصيداً، راجع المستحقات، وتابع سجل المدفوعات من شاشة واحدة واضحة.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">المستحق الآن</p>
                <p className="mt-2 text-2xl font-black text-brand-dark">{pendingPayments.length.toLocaleString('ar-IQ')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">إضافات الرصيد</p>
                <p className="mt-2 text-2xl font-black text-brand-dark">{creditTransactions.length.toLocaleString('ar-IQ')}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/90 p-4 shadow-sm">
                <p className="text-[11px] font-black text-slate-400">آخر تحديث</p>
                <p className="mt-2 text-sm font-black text-brand-dark">{dashboard?.payments?.[0]?.date || 'لا توجد معاملات'}</p>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl bg-brand-navy p-6 text-white shadow-xl shadow-brand-navy/15">
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
          <section id="add-credit-balance" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
                      className={`rounded-2xl border p-4 text-right transition ${selectedMethodId === method.id ? 'border-brand-navy bg-brand-navy/5 shadow-sm' : 'border-slate-200 bg-white hover:border-brand-navy/30'}`}
                    >
                      <i className={`fa-solid ${method.icon} text-lg text-brand-gold`}></i>
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">ملخص الإضافة</p>
                <p className="mt-4 text-3xl font-black text-brand-dark">{formatCurrency(amountToUse)}</p>
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

          <section id="billing-transactions" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-brand-dark">المعاملات والفواتير</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">سجل واضح يساعدك على معرفة ما تم دفعه وما يزال معلقاً.</p>
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

            {isLoading ? (
              <div className="mt-4 grid gap-3">
                {[0, 1, 2].map((item) => (
                  <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                ))}
              </div>
            ) : (dashboard?.payments || []).length > 0 ? (
              <div className="mt-4 grid gap-3">
                {(dashboard?.payments || []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
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
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">المطلوب الآن</h2>
            <div className="mt-4 space-y-3">
              {pendingPayments.length > 0 ? (
                pendingPayments.map((item) => (
                  <div key={item.id} className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-4">
                    <p className="text-sm font-black text-brand-dark">{item.label}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{item.amount}</p>
                    <p className="mt-1 text-xs font-bold text-amber-700">الحالة: {item.status}</p>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-black text-emerald-700">
                  لا توجد مدفوعات معلقة حالياً.
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
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
