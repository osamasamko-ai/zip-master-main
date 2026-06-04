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
  const [publishing, setPublishing] = useState(false);
  const [clientListings, setClientListings] = useState<any[]>([]);
  const [lawyerListings, setLawyerListings] = useState<any[]>([]);
  const [respondingId, setRespondingId] = useState('');
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

  const generate = () => {
    if (!canGenerate) return;
    setSubmittedProblem(problem.trim());
    setCompletedRequirements({});
    setCaseNotes('');
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
      data.append('readiness', String(readiness));
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

  const respondToListing = async (id: string, decision: 'accept' | 'reject') => {
    setRespondingId(`${id}-${decision}`);
    try {
      await apiClient.respondToCaseMarketplaceListing(id, { decision });
      await loadMarketplace();
    } finally {
      setRespondingId('');
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
                  <p className="text-xs font-black text-slate-400">نص قابل للمشاركة</p>
                  <p className="mt-2 whitespace-pre-line text-sm font-bold leading-7 text-slate-600">{plan.shareText}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100 sm:w-56">
                    <div className="h-full rounded-full bg-brand-gold transition-all" style={{ width: `${readiness}%` }} />
                  </div>
                  <div>
                    <p className="text-xs font-black text-brand-gold">إكمال المتطلبات داخل نفس الصفحة</p>
                    <h3 className="mt-2 text-lg font-black text-brand-dark">جاهزية الملف: {readiness}%</h3>
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
                      الجاهزية: {readiness}%
                      <br />
                      ملاحظات: {caseNotes.trim() || 'لم تتم إضافة ملاحظات بعد'}
                    </p>
                    <button
                      type="button"
                      onClick={() => navigate(readiness >= 60 ? '/lawyers' : '/aichat')}
                      className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-black text-brand-navy transition hover:bg-brand-lightgold"
                    >
                      {readiness >= 60 ? 'اختيار محام مناسب' : 'إكمال التفاصيل مع المساعد'}
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
                    <MarketplaceListingCard key={item.id} item={item} />
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
                          <span className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-black text-slate-500">قرارك: {item.offerStatus === 'accepted' ? 'قبول' : 'رفض'}</span>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => respondToListing(item.id, 'reject')}
                              disabled={Boolean(respondingId)}
                              className="rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-600"
                            >
                              رفض
                            </button>
                            <button
                              type="button"
                              onClick={() => respondToListing(item.id, 'accept')}
                              disabled={Boolean(respondingId)}
                              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                            >
                              قبول الدعوى
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
      </div>
    </main>
  );
}

function MarketplaceListingCard({ item, action }: { item: any; action?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        {action || (
          <span className={`rounded-xl px-3 py-2 text-xs font-black ${item.status === 'assigned' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
            {item.status === 'assigned' ? `تم اختيار ${item.selectedLawyerName || 'محام'}` : 'بانتظار المحامين'}
          </span>
        )}
        <div>
          <p className="text-sm font-black text-brand-dark">{item.title}</p>
          <p className="mt-1 text-xs font-bold text-slate-500">{Number(item.budget || 0).toLocaleString('en-US')} د.ع · جاهزية {item.readiness}%</p>
        </div>
      </div>
      <p className="mt-3 line-clamp-2 text-xs font-bold leading-6 text-slate-500">{item.matter}</p>
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
