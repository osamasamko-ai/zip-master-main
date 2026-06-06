import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { buildLegalActionPlan, LegalPlan } from '../utils/legalActionPlan';

const examples = [
  'صاحب البيت طردني من الشقة بدون إنذار',
  'شخص عليه دين ولم يرجع المبلغ',
  'أريد معرفة خطوات النفقة والحضانة',
  'شريكي في الشركة أخذ الأرباح ولم يسلمني حصتي',
];

const urgencyStyles: Record<LegalPlan['urgency'], string> = {
  critical: 'border-red-200 bg-red-50 text-red-700',
  high: 'border-amber-200 bg-amber-50 text-amber-700',
  medium: 'border-blue-200 bg-blue-50 text-blue-700',
};

function getReadinessLabel(score: number) {
  if (score >= 85) return 'جاهزة جداً';
  if (score >= 70) return 'جاهزة للنشر';
  if (score >= 50) return 'تحتاج تحسين';
  return 'غير مكتملة';
}

function assessCaseReadiness({
  requirementRatio,
  notes,
  budget,
  filesCount,
  problem,
}: {
  requirementRatio: number;
  notes: string;
  budget: string;
  filesCount: number;
  problem: string;
}) {
  const missing: string[] = [];
  const budgetAmount = Number(String(budget || '').replace(/[^\d.]/g, ''));
  const notesLength = notes.trim().length;
  const problemLength = problem.trim().length;
  let score = Math.round(requirementRatio * 45);

  if (notesLength >= 80) score += 15;
  else if (notesLength >= 30) score += 8;
  else missing.push('أضف ملخصاً أوضح يتضمن التواريخ، الأطراف، والمبلغ أو الضرر.');

  if (Number.isFinite(budgetAmount) && budgetAmount > 0) score += 15;
  else missing.push('حدد ميزانية مبدئية حتى يستطيع المحامي تقديم عرض واقعي.');

  if (filesCount > 0) score += 15;
  else missing.push('ارفع وثيقة واحدة على الأقل مثل وصل، عقد، محادثات، أو هوية مستندة للقضية.');

  if (problemLength >= 120) score += 10;
  else if (problemLength >= 60) score += 6;
  else missing.push('وسّع وصف المشكلة قبل النشر ليفهم المحامي الوقائع بسرعة.');

  if (requirementRatio < 1) missing.push('أكمل المستندات والخطوات غير المحددة في قائمة المتطلبات.');

  const normalizedScore = Math.max(0, Math.min(100, score));
  return {
    score: normalizedScore,
    label: getReadinessLabel(normalizedScore),
    missing: missing.slice(0, 5),
  };
}

export default function LegalActionPlan() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [problem, setProblem] = useState('');
  const [submittedProblem, setSubmittedProblem] = useState('');
  const [completedRequirements, setCompletedRequirements] = useState<Record<string, boolean>>({});
  const [caseNotes, setCaseNotes] = useState('');
  const [caseBudget, setCaseBudget] = useState('');
  const [caseFiles, setCaseFiles] = useState<File[]>([]);
  const [marketplaceMessage, setMarketplaceMessage] = useState('');
  const [marketplaceError, setMarketplaceError] = useState('');
  const [shareFeedback, setShareFeedback] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [clientListings, setClientListings] = useState<any[]>([]);
  const [lawyerListings, setLawyerListings] = useState<any[]>([]);
  const [respondingId, setRespondingId] = useState('');
  const [negotiationListing, setNegotiationListing] = useState<any | null>(null);
  const [negotiationMessages, setNegotiationMessages] = useState<any[]>([]);
  const [negotiationText, setNegotiationText] = useState('');
  const [negotiationLoading, setNegotiationLoading] = useState(false);
  const [negotiationFinalizing, setNegotiationFinalizing] = useState(false);
  const plan = useMemo(() => (submittedProblem ? buildLegalActionPlan(submittedProblem) : null), [submittedProblem]);
  const canGenerate = problem.trim().length >= 12;
  const completionItems = useMemo(() => {
    if (!plan) return [];
    return [
      ...plan.requiredDocuments.map((item) => ({ id: `doc-${item}`, label: item, type: 'مستند' })),
      ...plan.nextSteps.map((item) => ({ id: `step-${item}`, label: item, type: 'خطوة' })),
    ];
  }, [plan]);
  const completedCount = completionItems.filter((item) => completedRequirements[item.id]).length;
  const readiness = completionItems.length ? Math.round((completedCount / completionItems.length) * 100) : 0;
  const readinessAssessment = useMemo(
    () =>
      assessCaseReadiness({
        requirementRatio: completionItems.length ? completedCount / completionItems.length : 0,
        notes: caseNotes,
        budget: caseBudget,
        filesCount: caseFiles.length,
        problem: submittedProblem,
      }),
    [caseBudget, caseFiles.length, caseNotes, completedCount, completionItems.length, submittedProblem],
  );
  const suggestedBudget = useMemo(() => {
    if (!plan) return 0;
    if (plan.urgency === 'critical') return 750000;
    if (plan.category.includes('مطالبة') || plan.category.includes('شركة')) return 500000;
    if (plan.category.includes('أحوال')) return 350000;
    return 250000;
  }, [plan]);
  const smartSuggestions = useMemo(() => {
    if (!plan) return [];
    const missing = completionItems.find((item) => !completedRequirements[item.id]);
    return [
      missing
        ? {
            id: 'missing',
            icon: 'fa-circle-check',
            title: `أكمل ${missing.type} مهم`,
            note: missing.label,
            action: 'تحديد كمكتمل',
            onClick: () => toggleRequirement(missing.id),
          }
        : {
            id: 'ready',
            icon: 'fa-shield-check',
            title: 'ملفك منظم وجاهز',
            note: 'يمكنك الآن نشر الدعوى أو اختيار محام مناسب.',
            action: 'عرض المحامين',
            onClick: () => navigate('/lawyers'),
          },
      {
        id: 'budget',
        icon: 'fa-money-bill-wave',
        title: 'مبلغ مقترح للدعوى',
        note: `${suggestedBudget.toLocaleString('en-US')} د.ع كبداية قابلة للتفاوض مع المحامي.`,
        action: 'استخدام المبلغ',
        onClick: () => setCaseBudget(String(suggestedBudget)),
      },
      {
        id: 'brief',
        icon: 'fa-message',
        title: 'رسالة مختصرة للمحامي',
        note: 'أضف ملخصاً واضحاً يزيد فرصة قبول الدعوى بسرعة.',
        action: 'إضافة للملاحظات',
        onClick: () =>
          setCaseNotes(
            `أرغب بعرض هذه الدعوى على محام متخصص. التصنيف: ${plan.category}. الأولوية: ${plan.urgencyLabel}. جاهزية الملف: ${readinessAssessment.score}%. أحتاج تقييماً للتكلفة والخطوة القانونية الأقرب.`,
          ),
      },
    ];
  }, [completedRequirements, completionItems, navigate, plan, readinessAssessment.score, suggestedBudget]);

  const generate = () => {
    if (!canGenerate) return;
    setSubmittedProblem(problem.trim());
    setCompletedRequirements({});
    setCaseNotes('');
    setShareFeedback('');
  };

  const toggleRequirement = (id: string) => {
    setCompletedRequirements((current) => ({ ...current, [id]: !current[id] }));
  };

  const loadMarketplace = async () => {
    if (!user) return;
    try {
      const clientResponse = await apiClient.getClientCaseMarketplaceListings();
      setClientListings(clientResponse.data || []);
    } catch {
      setClientListings([]);
    }
    if (user.role === 'pro' || user.role === 'admin') {
      try {
        const lawyerResponse = await apiClient.getLawyerCaseMarketplaceListings();
        setLawyerListings(lawyerResponse.data || []);
      } catch {
        setLawyerListings([]);
      }
    }
  };

  useEffect(() => {
    loadMarketplace();
  }, [user?.id, user?.role]);

  const publishMarketplaceCase = async () => {
    if (!plan || !submittedProblem.trim()) return;
    const budget = Number(caseBudget.replace(/[^\d.]/g, ''));
    if (!Number.isFinite(budget) || budget <= 0) {
      setMarketplaceError('حدد مبلغ الدعوى المقترح للمحامين.');
      return;
    }
    setPublishing(true);
    setMarketplaceError('');
    setMarketplaceMessage('');
    try {
      const data = new FormData();
      data.append('title', plan.category);
      data.append('matter', submittedProblem);
      data.append('category', plan.category);
      data.append('budget', String(budget));
      data.append('readiness', String(readinessAssessment.score));
      data.append('notes', caseNotes);
      data.append('location', String((user as any)?.location || ''));
      caseFiles.forEach((file) => data.append('documents', file));
      const response = await apiClient.publishCaseMarketplaceListing(data);
      setMarketplaceMessage(response.message || 'تم نشر الدعوى للمحامين.');
      setCaseFiles([]);
      await loadMarketplace();
    } catch (error: any) {
      setMarketplaceError(error?.response?.data?.error || 'تعذر نشر الدعوى.');
    } finally {
      setPublishing(false);
    }
  };

  const respondToListing = async (item: any, decision: 'accept' | 'reject') => {
    const id = item.id;
    setRespondingId(`${id}-${decision}`);
    try {
      await apiClient.respondToCaseMarketplaceListing(id, {
        decision,
        proposedPrice: decision === 'accept' ? Number(item.budget || 0) : undefined,
        evaluationDuration: decision === 'accept' ? '48 ساعة' : undefined,
        paymentMethod: decision === 'accept' ? 'حسب اتفاق العميل' : undefined,
      });
      await loadMarketplace();
    } finally {
      setRespondingId('');
    }
  };

  const copyShareBrief = async () => {
    if (!plan) return;
    try {
      await navigator.clipboard.writeText(plan.shareText);
      setShareFeedback('تم نسخ الموجز.');
    } catch {
      setShareFeedback('تعذر النسخ تلقائياً، يمكنك تحديد النص ونسخه.');
    }
  };

  const shareBrief = async () => {
    if (!plan) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'موجز قانوني أولي', text: plan.shareText });
        setShareFeedback('تم فتح نافذة المشاركة.');
        return;
      } catch {
        return;
      }
    }
    await copyShareBrief();
  };

  const openNegotiation = async (item: any) => {
    setNegotiationListing(item);
    setNegotiationLoading(true);
    setMarketplaceError('');
    try {
      const response = await apiClient.getCaseMarketplaceNegotiation(item.id);
      setNegotiationMessages(response.data?.messages || []);
    } catch (error: any) {
      setMarketplaceError(error?.response?.data?.error || 'تعذر فتح غرفة التفاوض.');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const sendNegotiationMessage = async () => {
    if (!negotiationListing || !negotiationText.trim()) return;
    setNegotiationLoading(true);
    try {
      const response = await apiClient.sendCaseMarketplaceNegotiationMessage(negotiationListing.id, negotiationText.trim());
      setNegotiationMessages(response.data || []);
      setNegotiationText('');
    } catch (error: any) {
      setMarketplaceError(error?.response?.data?.error || 'تعذر إرسال رسالة التفاوض.');
    } finally {
      setNegotiationLoading(false);
    }
  };

  const finalizeNegotiation = async () => {
    if (!negotiationListing) return;
    setNegotiationFinalizing(true);
    try {
      const response = await apiClient.finalizeCaseMarketplaceNegotiation(negotiationListing.id);
      setMarketplaceMessage(response.message || 'تم إنشاء القضية الرسمية.');
      setNegotiationListing(null);
      setNegotiationMessages([]);
      await loadMarketplace();
      navigate('/cases');
    } catch (error: any) {
      setMarketplaceError(error?.response?.data?.error || 'تعذر اعتماد الاتفاق.');
    } finally {
      setNegotiationFinalizing(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#f6f8fb] px-4 py-6 text-right sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-navy text-brand-gold">
                <i className="fa-solid fa-route text-lg" />
              </div>
              <div className="max-w-2xl">
                <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Legal Action Plan</p>
                <h1 className="mt-3 text-2xl font-black leading-tight text-brand-dark sm:text-4xl">اكتب مشكلتك واحصل على خطتك القانونية</h1>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-500">
                  هذه هي بوابة الانتشار: المستخدم لا يبحث عن محام فقط، بل يعرف تصنيف مشكلته، درجة الخطورة، المستندات المطلوبة، والخطوة التالية خلال دقيقة.
                </p>
              </div>
            </div>

            <div className="mt-6">
              <label className="mb-2 block text-sm font-black text-brand-dark">ما المشكلة القانونية؟</label>
              <textarea
                value={problem}
                onChange={(event) => setProblem(event.target.value)}
                rows={7}
                className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700 outline-none transition focus:border-brand-navy focus:bg-white focus:ring-4 focus:ring-brand-navy/10"
                placeholder="مثال: شخص استدان مني مبلغاً منذ شهرين ولدي وصل ومحادثات، لكنه يرفض الدفع..."
              />
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {examples.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => setProblem(example)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-500 transition hover:border-brand-gold hover:text-brand-dark"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-bold text-slate-400">لا تعتبر الخطة استشارة نهائية، لكنها تختصر الطريق وتجهز الملف للمحامي.</p>
              <button
                type="button"
                onClick={generate}
                disabled={!canGenerate}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-navy px-5 py-3 text-sm font-black text-white transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xs" />
                إنشاء الخطة
              </button>
            </div>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <h2 className="text-lg font-black text-brand-dark">لماذا هذه الميزة مهمة؟</h2>
            <div className="mt-4 space-y-3">
              {[
                ['تدخل مبكر', 'المستخدم يبدأ من وصف المشكلة وليس من معرفة اسم الخدمة.'],
                ['قابل للمشاركة', 'الخطة المختصرة تتحول إلى رسالة يمكن إرسالها لصديق أو محام.'],
                ['تحويل مباشر', 'كل نتيجة تقود إلى محام، عقد، قضية، أو محادثة ذكية.'],
              ].map(([title, note]) => (
                <div key={title} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-sm font-black text-brand-dark">{title}</p>
                  <p className="mt-1 text-xs font-bold leading-6 text-slate-500">{note}</p>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {plan ? (
          <section className="mt-5 grid gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <span className={`inline-flex rounded-xl border px-3 py-2 text-xs font-black ${urgencyStyles[plan.urgency]}`}>
                الأولوية: {plan.urgencyLabel}
              </span>
              <h2 className="mt-4 text-2xl font-black text-brand-dark">{plan.category}</h2>
              <p className="mt-3 text-sm font-bold leading-7 text-slate-500">{plan.summary}</p>
              <div className="mt-4 rounded-xl bg-brand-navy p-4 text-white">
                <p className="text-xs font-black text-brand-gold">التكلفة المتوقعة</p>
                <p className="mt-2 text-sm font-black">{plan.estimatedCost}</p>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {plan.matchingSpecialties.map((item) => (
                  <span key={item} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-600">{item}</span>
                ))}
              </div>
            </div>

            <div className="grid gap-5 md:grid-cols-2">
              <PlanPanel icon="fa-list-check" title="الخطوات التالية" items={plan.nextSteps} />
              <PlanPanel icon="fa-folder-open" title="المستندات المطلوبة" items={plan.requiredDocuments} />
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                <h3 className="text-lg font-black text-brand-dark">حوّل الخطة إلى إجراء</h3>
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  <ActionCard icon="fa-scale-balanced" title="ابحث عن محام" note="اعرض المتخصصين المناسبين." onClick={() => navigate('/lawyers')} />
                  <ActionCard icon="fa-file-contract" title="جهز مستند" note="ابدأ عقداً أو مسودة مطالبة." onClick={() => navigate('/contracts')} />
                  <ActionCard icon="fa-robot" title="اسأل المساعد" note="حوّل الخطة إلى سؤال تفصيلي." onClick={() => navigate('/aichat')} />
                </div>
                <div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={copyShareBrief}
                        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-brand-navy shadow-sm transition hover:bg-brand-navy hover:text-white"
                      >
                        نسخ
                      </button>
                      <button
                        type="button"
                        onClick={shareBrief}
                        className="rounded-xl bg-brand-navy px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-brand-dark"
                      >
                        مشاركة
                      </button>
                      {shareFeedback ? <span className="text-xs font-black text-emerald-700">{shareFeedback}</span> : null}
                    </div>
                    <p className="text-xs font-black text-slate-400">موجز قانوني قابل للمشاركة</p>
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm font-bold leading-7 text-slate-600">{plan.shareText}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                <div className="flex items-center justify-end gap-3">
                  <h3 className="text-lg font-black text-brand-dark">مقترحات لتحسين خطتي</h3>
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy text-brand-gold">
                    <i className="fa-solid fa-lightbulb" />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {smartSuggestions.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={item.onClick}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-right transition hover:border-brand-gold hover:bg-white"
                    >
                      <i className={`fa-solid ${item.icon} text-brand-gold`} />
                      <p className="mt-3 text-sm font-black text-brand-dark">{item.title}</p>
                      <p className="mt-1 min-h-12 text-xs font-bold leading-6 text-slate-500">{item.note}</p>
                      <span className="mt-3 inline-flex rounded-lg bg-brand-navy px-3 py-2 text-xs font-black text-white">{item.action}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-56">
                    <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${readinessAssessment.score}%` }} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-brand-gold">إكمال المتطلبات داخل نفس الصفحة</p>
                    <h3 className="mt-2 text-lg font-black text-brand-dark">جاهزية الدعوى: {readinessAssessment.score}% {readinessAssessment.label}</h3>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {completionItems.map((item) => {
                    const checked = Boolean(completedRequirements[item.id]);
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => toggleRequirement(item.id)}
                        className={`flex items-start justify-between gap-3 rounded-xl border p-4 text-right transition ${checked ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50 hover:border-brand-gold'}`}
                      >
                        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border text-xs ${checked ? 'border-emerald-500 bg-emerald-500 text-white' : 'border-slate-300 bg-white text-slate-300'}`}>
                          <i className="fa-solid fa-check" />
                        </span>
                        <span className="flex-1">
                          <span className="block text-[11px] font-black text-brand-gold">{item.type}</span>
                          <span className={`mt-1 block text-sm font-bold leading-6 ${checked ? 'text-emerald-800 line-through decoration-emerald-500/60' : 'text-slate-600'}`}>{item.label}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                  <textarea
                    value={caseNotes}
                    onChange={(event) => setCaseNotes(event.target.value)}
                    rows={5}
                    className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm font-bold leading-7 text-slate-700 outline-none focus:border-brand-navy focus:bg-white focus:ring-4 focus:ring-brand-navy/10"
                    placeholder="أضف ملاحظاتك: التواريخ، أسماء الأطراف، المبلغ، الشهود، أو أي تفاصيل يريد المحامي معرفتها..."
                  />
                  <div className="rounded-xl bg-brand-navy p-4 text-white">
                    <p className="text-xs font-black text-brand-gold">ملخص جاهز للمحامي</p>
                    <p className="mt-3 text-sm font-bold leading-7">
                      التصنيف: {plan.category}
                      <br />
                      الأولوية: {plan.urgencyLabel}
                      <br />
                      الجاهزية: {readinessAssessment.score}% - {readinessAssessment.label}
                      <br />
                      ملاحظات: {caseNotes.trim() || 'لم تتم إضافة ملاحظات بعد'}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(readinessAssessment.score >= 60 ? '/lawyers' : '/aichat')}
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-brand-navy transition hover:bg-brand-lightgold"
                    >
                      {readinessAssessment.score >= 60 ? 'اختيار محام مناسب' : 'إكمال التفاصيل مع المساعد'}
                    </button>
                  </div>
                </div>
                <div className="mt-4 rounded-2xl border border-brand-gold/30 bg-[#fffaf0] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      {marketplaceMessage && <span className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700">{marketplaceMessage}</span>}
                      {marketplaceError && <span className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700">{marketplaceError}</span>}
                    </div>
                    <div>
                      <p className="text-xs font-black text-brand-gold">نشر الدعوى للمحامين</p>
                      <h3 className="mt-1 text-lg font-black text-brand-dark">اعرضها على القريبين والمقترحين</h3>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)]">
                    <input
                      value={caseBudget}
                      onChange={(event) => setCaseBudget(event.target.value)}
                      inputMode="numeric"
                      className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-brand-dark outline-none focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/10"
                      placeholder="المبلغ المقترح د.ع"
                    />
                    <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-3 text-sm font-black text-slate-500 transition hover:border-brand-gold">
                      <span>{caseFiles.length ? `${caseFiles.length} ملفات مختارة` : 'رفع وثائق الدعوى'}</span>
                      <i className="fa-solid fa-cloud-arrow-up text-brand-gold" />
                      <input
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(event) => setCaseFiles(Array.from(event.target.files || []).slice(0, 8))}
                      />
                    </label>
                  </div>
                  <div className="mt-4 rounded-xl bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="rounded-xl bg-brand-navy px-3 py-2 text-xs font-black text-white">{readinessAssessment.score}% {readinessAssessment.label}</span>
                      <p className="text-sm font-black text-brand-dark">تقييم جاهزية الدعوى قبل النشر</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-brand-gold" style={{ width: `${readinessAssessment.score}%` }} />
                    </div>
                    {readinessAssessment.missing.length ? (
                      <div className="mt-3 space-y-2">
                        {readinessAssessment.missing.map((item) => (
                          <div key={item} className="flex items-start justify-end gap-2 text-right text-xs font-bold leading-6 text-slate-600">
                            <span>{item}</span>
                            <i className="fa-solid fa-circle-exclamation mt-1 text-brand-gold" />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs font-black text-emerald-700">ملفك منظم بما يكفي لزيادة فرصة قبول عروض المحامين.</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={publishMarketplaceCase}
                    disabled={publishing}
                    className="mt-3 w-full rounded-xl bg-brand-navy px-4 py-3 text-sm font-black text-white transition hover:bg-brand-dark disabled:bg-slate-300"
                  >
                    {publishing ? 'جار نشر الدعوى...' : 'نشر الدعوى للمحامين'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {(clientListings.length > 0 || lawyerListings.length > 0) && (
          <section className="mt-5 grid gap-5 lg:grid-cols-2">
            {clientListings.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-brand-dark">دعاواي المنشورة</h3>
                <div className="mt-4 space-y-3">
                  {clientListings.slice(0, 4).map((item) => (
                    <MarketplaceListingCard
                      key={item.id}
                      item={item}
                      action={
                        item.status === 'negotiating' ? (
                          <button
                            type="button"
                            onClick={() => openNegotiation(item)}
                            className="rounded-xl bg-brand-navy px-3 py-2 text-xs font-black text-white"
                          >
                            فتح غرفة التفاوض
                          </button>
                        ) : undefined
                      }
                    />
                  ))}
                </div>
              </div>
            )}
            {lawyerListings.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h3 className="text-lg font-black text-brand-dark">دعاوى مقترحة للمحامي</h3>
                <div className="mt-4 space-y-3">
                  {lawyerListings.slice(0, 5).map((item) => (
                    <MarketplaceListingCard
                      key={item.id}
                      item={item}
                      action={
                        item.offerStatus ? (
                          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">قرارك: {item.offerStatus === 'negotiating' ? 'تفاوض أولي' : item.offerStatus === 'accepted' ? 'قبول' : 'رفض'}</span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => respondToListing(item, 'reject')}
                              disabled={Boolean(respondingId)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                            >
                              رفض
                            </button>
                            <button
                              type="button"
                              onClick={() => respondToListing(item, 'accept')}
                              disabled={Boolean(respondingId)}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                            >
                              قبول مبدئي
                            </button>
                          </div>
                        )
                      }
                    />
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {negotiationListing ? (
          <section className="mt-5 rounded-2xl border border-brand-gold/30 bg-[#fffaf0] p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setNegotiationListing(null)}
                className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-500"
              >
                إغلاق
              </button>
              <div>
                <p className="text-xs font-black text-brand-gold">غرفة تفاوض أولية</p>
                <h3 className="mt-1 text-lg font-black text-brand-dark">{negotiationListing.title}</h3>
              </div>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <InfoBox label="عرض المحامي" value={`${Number(negotiationListing.proposedPrice || 0).toLocaleString('en-US')} د.ع`} />
              <InfoBox label="مدة التقييم" value={negotiationListing.evaluationDuration || 'غير محددة'} />
              <InfoBox label="طريقة الدفع" value={negotiationListing.paymentMethod || 'غير محددة'} />
            </div>
            {negotiationListing.requestedDocuments ? (
              <div className="mt-3 rounded-xl bg-white p-4">
                <p className="text-xs font-black text-brand-gold">وثائق طلبها المحامي</p>
                <p className="mt-2 whitespace-pre-line text-sm font-bold leading-7 text-slate-600">{negotiationListing.requestedDocuments}</p>
              </div>
            ) : null}
            <div className="mt-4 max-h-72 space-y-3 overflow-y-auto rounded-2xl bg-white p-4">
              {negotiationLoading && negotiationMessages.length === 0 ? (
                <p className="py-6 text-center text-sm font-black text-slate-400">جار تحميل الرسائل...</p>
              ) : negotiationMessages.length === 0 ? (
                <p className="py-6 text-center text-sm font-black text-slate-400">لا توجد رسائل بعد.</p>
              ) : (
                negotiationMessages.map((message) => {
                  const mine = message.senderRole !== 'lawyer';
                  return (
                    <div key={message.id} className={`flex ${mine ? 'justify-start' : 'justify-end'}`}>
                      <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm font-bold leading-7 ${mine ? 'bg-brand-navy text-white' : 'bg-slate-100 text-slate-700'}`}>
                        <p className="whitespace-pre-line">{message.text}</p>
                        <p className={`mt-2 text-[10px] font-black ${mine ? 'text-white/55' : 'text-slate-400'}`}>{message.senderName || (mine ? 'أنت' : 'المحامي')}</p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_150px]">
              <textarea
                value={negotiationText}
                onChange={(event) => setNegotiationText(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-xl bg-white p-4 text-sm font-bold leading-7 text-slate-700 outline-none focus:ring-4 focus:ring-brand-navy/10"
                placeholder="اسأل عن السعر، نطاق العمل، الوثائق، أو طريقة الدفع قبل إنشاء القضية..."
              />
              <button
                type="button"
                onClick={sendNegotiationMessage}
                disabled={!negotiationText.trim() || negotiationLoading}
                className="rounded-xl bg-brand-navy px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
              >
                {negotiationLoading ? 'جار الإرسال...' : 'إرسال'}
              </button>
            </div>
            <button
              type="button"
              onClick={finalizeNegotiation}
              disabled={negotiationFinalizing}
              className="mt-3 w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:bg-slate-300"
            >
              {negotiationFinalizing ? 'جار إنشاء القضية...' : 'اعتماد الاتفاق وإنشاء القضية الرسمية'}
            </button>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-4">
      <p className="text-xs font-black text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-brand-dark">{value}</p>
    </div>
  );
}

function MarketplaceListingCard({ item, action }: { item: any; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {action || (
          <span className={`rounded-xl px-3 py-2 text-xs font-black ${item.status === 'assigned' ? 'bg-emerald-50 text-emerald-700' : item.status === 'negotiating' ? 'bg-brand-gold/15 text-brand-gold' : 'bg-amber-50 text-amber-700'}`}>
            {item.status === 'assigned' ? `تم اختيار ${item.selectedLawyerName || 'محام'}` : item.status === 'negotiating' ? `تفاوض جارٍ مع ${item.selectedLawyerName || 'المحامي'}` : 'بانتظار المحامين'}
          </span>
        )}
        <div>
          <p className="text-sm font-black text-brand-dark">{item.title}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{Number(item.budget || 0).toLocaleString('en-US')} د.ع · جاهزية {item.readiness}%</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs font-bold leading-6 text-slate-500">{item.matter}</p>
      {item.status === 'assigned' && item.proposedPrice ? (
        <div className="mt-3 grid gap-2 rounded-xl bg-white p-3 text-xs font-black text-slate-600 sm:grid-cols-2">
          <span>السعر: {Number(item.proposedPrice || 0).toLocaleString('en-US')} د.ع</span>
          <span>مدة التقييم: {item.evaluationDuration || 'غير محددة'}</span>
          <span>الدفع: {item.paymentMethod || 'غير محدد'}</span>
          <span>وثائق مطلوبة: {item.requestedDocuments || 'لا توجد'}</span>
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap justify-end gap-2">
        {item.nearby && <span className="rounded-lg bg-blue-50 px-2 py-1 text-[11px] font-black text-blue-700">قريب</span>}
        {item.suggested && <span className="rounded-lg bg-brand-gold/10 px-2 py-1 text-[11px] font-black text-brand-gold">مقترح</span>}
        <span className="rounded-lg bg-white px-2 py-1 text-[11px] font-black text-slate-500">{item.documents?.length || 0} وثائق</span>
      </div>
    </div>
  );
}

function PlanPanel({ icon, title, items }: { icon: string; title: string; items: string[] }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-end gap-3">
        <h3 className="text-lg font-black text-brand-dark">{title}</h3>
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gold/10 text-brand-gold">
          <i className={`fa-solid ${icon}`} />
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {items.map((item, index) => (
          <div key={item} className="flex items-start justify-end gap-3 rounded-xl bg-slate-50 p-3">
            <p className="flex-1 text-sm font-bold leading-6 text-slate-600">{item}</p>
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white text-xs font-black text-brand-navy">{index + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActionCard({ icon, title, note, onClick }: { icon: string; title: string; note: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="rounded-xl border border-slate-200 bg-white p-4 text-right transition hover:border-brand-navy hover:shadow-sm">
      <i className={`fa-solid ${icon} text-brand-navy`} />
      <p className="mt-3 text-sm font-black text-brand-dark">{title}</p>
      <p className="mt-1 text-xs font-bold leading-5 text-slate-500">{note}</p>
    </button>
  );
}
