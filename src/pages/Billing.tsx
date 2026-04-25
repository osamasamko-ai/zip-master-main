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

const PRESET_AMOUNTS = [25000, 50000, 100000, 250000];

export default function Billing() {
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [selectedAmount, setSelectedAmount] = useState<number>(PRESET_AMOUNTS[1]);
  const [customAmount, setCustomAmount] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.getDashboard();
        setDashboard(response.data);
      } catch (error) {
        console.error('Failed to load billing data', error);
      }
    };

    load();
  }, []);

  const availableBalance = dashboard?.summary?.accountBalance ?? 0;
  const amountToUse = customAmount ? Number(customAmount) || 0 : selectedAmount;
  const pendingPayments = useMemo(
    () => (dashboard?.payments || []).filter((item) => item.status !== 'مدفوع'),
    [dashboard?.payments],
  );

  return (
    <div className="app-view fade-in space-y-8 pb-12 text-right">
      <section className="rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-8 shadow-premium">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Billing</p>
            <h1 className="mt-3 text-3xl font-black text-brand-dark">الرصيد والمدفوعات</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              راجع الرصيد الحالي، افهم ما هو مستحق الآن، وجهّز شحن المحفظة بسرعة. الرصيد والمعاملات هنا مرتبطة ببياناتك الحقيقية الحالية.
            </p>
          </div>

          <div className="rounded-[2rem] bg-brand-navy p-6 text-white shadow-xl shadow-brand-navy/15">
            <p className="text-sm font-black text-blue-200">الرصيد المتاح</p>
            <p className="mt-3 text-4xl font-black">
              {availableBalance.toLocaleString('ar-IQ')} <span className="text-base text-brand-gold">IQD</span>
            </p>
            <p className="mt-2 text-xs font-bold text-blue-100">يتم جلب هذا الرصيد من الحساب الحالي مباشرة.</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <ActionButton
                onClick={() => document.getElementById('billing-transactions')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                variant="secondary"
                className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white"
              >
                عرض المعاملات
              </ActionButton>
              <ActionButton onClick={() => navigate('/cases', { state: { openNewCase: true } })} variant="secondary" className="w-full border-white/20 bg-white/10 text-white hover:bg-white/20 hover:text-white">
                افتح قضية
              </ActionButton>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section id="billing-transactions" className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-brand-dark">إضافة رصيد</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">واجهة جاهزة للشحن السريع بمجرد ربط بوابة الدفع المخصصة للمستخدمين.</p>
              </div>
              <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[11px] font-black text-amber-700">
                يحتاج ربط API للشحن
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
                  className={`rounded-2xl border px-4 py-4 text-center text-sm font-black transition ${!customAmount && selectedAmount === amount ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-brand-navy hover:bg-white'}`}
                >
                  {amount.toLocaleString('ar-IQ')} د.ع
                </button>
              ))}
            </div>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <label className="block text-[11px] font-black uppercase tracking-widest text-slate-400">مبلغ مخصص</label>
                <input
                  type="number"
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="أدخل المبلغ الذي تريد إضافته"
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700 outline-none transition focus:border-brand-navy"
                />
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">ملخص العملية</p>
                <p className="mt-3 text-2xl font-black text-brand-dark">{amountToUse.toLocaleString('ar-IQ')} د.ع</p>
                <p className="mt-1 text-xs font-bold text-slate-500">طريقة الدفع الموصى بها: زين كاش أو كي كارد</p>
              </div>
            </div>

            <div className="mt-4 rounded-[1.5rem] border border-dashed border-slate-300 bg-slate-50 px-4 py-4">
              <p className="text-sm font-black text-brand-dark">الإجراء التالي الواضح</p>
              <p className="mt-1 text-xs font-bold leading-6 text-slate-500">
                تم إعداد هذه الواجهة لتقليل الخطوات إلى اختيار مبلغ ثم طريقة دفع ثم تأكيد. ما يزال الشحن الفعلي يحتاج نقطة API مخصصة للمستخدم النهائي حتى لا نعرض عملية وهمية.
              </p>
            </div>
          </section>

          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-black text-brand-dark">المعاملات والفواتير</h2>
                <p className="mt-1 text-xs font-bold text-slate-500">سجل واضح يساعدك على معرفة ما تم دفعه وما يزال معلقاً.</p>
              </div>
            </div>

            {(dashboard?.payments || []).length > 0 ? (
              <div className="mt-4 grid gap-3">
                {(dashboard?.payments || []).map((item) => (
                  <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-full px-3 py-1 text-[11px] font-black ${item.status === 'مدفوع' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                        {item.status}
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-black text-brand-dark">{item.label}</p>
                        <p className="mt-1 text-xs font-bold text-slate-500">{item.date}</p>
                      </div>
                    </div>
                    <p className="mt-3 text-sm font-black text-brand-dark">{item.amount}</p>
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
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
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
