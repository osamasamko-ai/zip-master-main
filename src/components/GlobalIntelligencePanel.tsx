import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useUserIntelligence } from '../hooks/useIntelligence';

type GlobalIntelligencePanelProps = {
  open: boolean;
  onClose: () => void;
};

const priorityTone: Record<string, string> = {
  high: 'border-red-100 bg-red-50 text-red-700',
  medium: 'border-amber-100 bg-amber-50 text-amber-700',
  low: 'border-slate-100 bg-slate-50 text-slate-600',
};

export default function GlobalIntelligencePanel({ open, onClose }: GlobalIntelligencePanelProps) {
  const navigate = useNavigate();
  const { data, loading, refresh } = useUserIntelligence();

  const recommendations = data?.recommendations || [];
  const assistant = data?.assistant || null;
  const healthChecks = data?.healthChecks || [];
  const dailyBrief = data?.dailyBrief || null;
  const caseRisk = data?.caseRisk || [];
  const topPriority = recommendations[0] || null;

  const urgencyLabel = useMemo(() => {
    if (!topPriority) return 'مستقر';
    if (topPriority.priority === 'high') return 'عاجل';
    if (topPriority.priority === 'medium') return 'متابعة';
    return 'اقتراح';
  }, [topPriority]);

  const openTarget = (target?: string) => {
    if (!target) return;
    navigate(target);
    onClose();
  };

  const openAiBrief = (prompt?: string) => {
    navigate('/aichat', {
      state: {
        initialQuery:
          prompt ||
          'حلل لي وضعي الحالي في منصة القسطاس الرقمي واقترح أهم خطوة قانونية أو إجرائية تالية.',
      },
    });
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[280] bg-brand-dark/25 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.aside
            initial={{ x: -420, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -420, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 360, damping: 34 }}
            className="absolute left-0 top-0 flex h-full w-full max-w-md flex-col overflow-hidden border-r border-slate-200 bg-white text-right shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-slate-100 bg-[linear-gradient(135deg,#ffffff_0%,#eef4fb_100%)] p-5">
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white text-slate-400 shadow-sm ring-1 ring-slate-100 transition hover:text-red-500"
                  aria-label="إغلاق الذكاء"
                >
                  <i className="fa-solid fa-xmark"></i>
                </button>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-brand-gold">Intelligence Layer</p>
                  <h2 className="mt-2 text-2xl font-black text-brand-dark">مساعد الموقع الذكي</h2>
                  <p className="mt-2 text-xs font-bold leading-6 text-slate-500">
                    يقرأ نشاطك، ملفاتك، رسائلك، وثائقك، ومدفوعاتك ليقترح الخطوة الأهم الآن.
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-brand-navy/10 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-[10px] font-black ${priorityTone[topPriority?.priority || 'low']}`}>
                    {urgencyLabel}
                  </span>
                  <div className="text-right">
                    <p className="text-sm font-black text-brand-dark">{assistant?.headline || 'كل شيء مستقر حالياً'}</p>
                    <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{assistant?.summary || 'ستظهر هنا الأولويات عندما تتوفر بيانات كافية.'}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openAiBrief(assistant?.aiBrief)}
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-navy px-4 py-3 text-xs font-black text-white shadow-lg shadow-brand-navy/15 transition hover:bg-brand-dark"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  {assistant?.aiAction || 'ابدأ تحليل ذكي'}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
              <div className="mb-4 grid grid-cols-2 gap-3">
                {healthChecks.map((item: any) => (
                  <div key={item.label} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <p className="text-[10px] font-black text-slate-400">{item.label}</p>
                    <p className="mt-2 text-2xl font-black text-brand-navy">{Number(item.value || 0).toLocaleString('ar-IQ')}</p>
                  </div>
                ))}
              </div>

              {dailyBrief && (
                <section className="mb-4 rounded-[1.35rem] border border-brand-gold/20 bg-brand-gold/10 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand-gold shadow-sm">
                      <i className="fa-solid fa-sun"></i>
                    </span>
                    <div>
                      <p className="text-sm font-black text-brand-dark">{dailyBrief.title}</p>
                      <p className="mt-1 text-[11px] font-bold leading-5 text-slate-500">{dailyBrief.summary}</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {(dailyBrief.items || []).map((item: any) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => openTarget(item.target)}
                        className="flex w-full items-center justify-between gap-3 rounded-xl bg-white/80 px-3 py-2 text-right transition hover:bg-white hover:shadow-sm"
                      >
                        <i className="fa-solid fa-arrow-left text-[10px] text-slate-300"></i>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-black text-brand-dark">{item.title}</p>
                          <p className="mt-0.5 truncate text-[10px] font-bold text-slate-500">{item.detail}</p>
                        </div>
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-navy/5 text-brand-navy">
                          <i className={`fa-solid ${item.icon || 'fa-sparkles'} text-xs`}></i>
                        </span>
                      </button>
                    ))}
                  </div>
                </section>
              )}

              {caseRisk.length > 0 && (
                <section className="mb-4 rounded-[1.35rem] border border-slate-100 bg-white p-4 shadow-sm">
                  <h3 className="text-sm font-black text-brand-dark">مؤشر مخاطر الملفات</h3>
                  <div className="mt-3 space-y-2">
                    {caseRisk.slice(0, 3).map((item: any) => (
                      <div key={item.caseId} className="rounded-xl bg-slate-50 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`rounded-full px-2 py-1 text-[9px] font-black ${item.level === 'high' ? 'bg-red-50 text-red-600' : item.level === 'medium' ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                            {item.score}%
                          </span>
                          <p className="truncate text-xs font-black text-brand-dark">{item.title}</p>
                        </div>
                        <p className="mt-1 truncate text-[10px] font-bold text-slate-500">{item.nextAction}</p>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              <div className="mb-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black text-slate-500 transition hover:border-brand-navy hover:text-brand-navy"
                >
                  <i className={`fa-solid ${loading ? 'fa-spinner fa-spin' : 'fa-rotate'} ml-1`}></i>
                  تحديث
                </button>
                <h3 className="text-sm font-black text-brand-dark">الأولويات الذكية</h3>
              </div>

              {recommendations.length === 0 ? (
                <div className="rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
                  <i className="fa-solid fa-shield-check text-2xl text-emerald-500"></i>
                  <p className="mt-3 text-sm font-black text-brand-dark">لا توجد أولوية حرجة</p>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-400">استمر في استخدام المنصة وستظهر التوصيات حسب نشاطك.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {recommendations.map((item: any) => (
                    <article
                      key={item.id}
                      className="group w-full rounded-[1.35rem] border border-slate-100 bg-white p-4 text-right shadow-sm transition hover:border-brand-navy/20 hover:shadow-md"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className={`rounded-full border px-2.5 py-1 text-[9px] font-black ${priorityTone[item.priority || 'low']}`}>
                          {item.priority === 'high' ? 'عاجل' : item.priority === 'medium' ? 'متابعة' : 'اقتراح'}
                        </span>
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-navy/5 text-brand-navy">
                          <i className={`fa-solid ${item.icon || 'fa-sparkles'} text-sm`}></i>
                        </span>
                      </div>
                      <p className="mt-3 text-sm font-black text-brand-dark">{item.title}</p>
                      <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{item.description}</p>
                      {item.impact && (
                        <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-[10px] font-bold leading-5 text-slate-500">
                          <i className="fa-solid fa-bolt ml-1 text-brand-gold"></i>
                          {item.impact}
                        </p>
                      )}
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => openAiBrief(item.aiBrief)}
                          className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-brand-dark"
                        >
                          <i className="fa-solid fa-wand-magic-sparkles"></i>
                          {item.aiAction || 'حلل بالذكاء'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openTarget(item.target)}
                          className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black text-brand-navy transition hover:border-brand-navy hover:bg-brand-navy/5"
                        >
                          {item.action}
                          <i className="fa-solid fa-arrow-left transition group-hover:-translate-x-1"></i>
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
