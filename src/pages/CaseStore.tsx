import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';

type CaseStoreListing = {
  id: string;
  title: string;
  matter: string;
  category: string;
  location?: string;
  clientName?: string;
  clientLocation?: string;
  budget: number;
  readiness: number;
  opportunityScore?: number;
  notes?: string;
  documents?: Array<{ name?: string; url?: string; mimeType?: string; size?: number }>;
  status: 'open' | 'assigned' | string;
  offerStatus?: 'accepted' | 'rejected' | string | null;
  offerNote?: string | null;
  proposedPrice?: number | null;
  evaluationDuration?: string | null;
  paymentMethod?: string | null;
  requestedDocuments?: string | null;
  suggested?: boolean | number;
  nearby?: boolean | number;
  createdAt?: string;
};

type StoreFilter = 'all' | 'suggested' | 'nearby' | 'unanswered' | 'reviewed';

const filters: Array<{ id: StoreFilter; label: string; icon: string }> = [
  { id: 'all', label: 'الكل', icon: 'fa-layer-group' },
  { id: 'suggested', label: 'المقترحة', icon: 'fa-wand-magic-sparkles' },
  { id: 'nearby', label: 'القريبة', icon: 'fa-location-dot' },
  { id: 'unanswered', label: 'بانتظار قراري', icon: 'fa-hourglass-half' },
  { id: 'reviewed', label: 'تمت مراجعتها', icon: 'fa-circle-check' },
];

function formatMoney(value: number) {
  return `${Number(value || 0).toLocaleString('en-US')} د.ع`;
}

function getAgeLabel(value?: string) {
  if (!value) return 'منشورة حديثاً';
  const diff = Date.now() - new Date(value).getTime();
  const hours = Math.max(0, Math.round(diff / 3_600_000));
  if (hours < 1) return 'قبل أقل من ساعة';
  if (hours < 24) return `قبل ${hours} ساعة`;
  return `قبل ${Math.round(hours / 24)} يوم`;
}

function offerLabel(status?: string | null) {
  if (status === 'accepted') return 'تم قبولها';
  if (status === 'rejected') return 'تم رفضها';
  return 'بانتظار قرارك';
}

function getOpportunityScore(item: CaseStoreListing) {
  return Math.max(0, Math.min(100, Number(item.opportunityScore || 0)));
}

function getOpportunityLabel(score: number) {
  if (score >= 80) return 'فرصة ممتازة';
  if (score >= 60) return 'فرصة قوية';
  if (score >= 40) return 'فرصة متوسطة';
  return 'تحتاج مراجعة';
}

function getOpportunityReasons(item: CaseStoreListing) {
  const reasons = [];
  if (Boolean(item.suggested)) reasons.push('مناسبة لتخصصك');
  if (Boolean(item.nearby)) reasons.push('قريبة منك');
  if (Number(item.budget || 0) >= 500000) reasons.push('ميزانية جيدة');
  if (Number(item.readiness || 0) >= 65) reasons.push('جاهزية عالية');
  if (item.documents?.length) reasons.push('وثائق مرفوعة');
  return reasons.length ? reasons : ['راجع التفاصيل قبل العرض'];
}

export default function CaseStore() {
  const navigate = useNavigate();
  const [listings, setListings] = useState<CaseStoreListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<StoreFilter>('all');
  const [selected, setSelected] = useState<CaseStoreListing | null>(null);
  const [reviewChecked, setReviewChecked] = useState(false);
  const [decisionNote, setDecisionNote] = useState('');
  const [proposedPrice, setProposedPrice] = useState('');
  const [evaluationDuration, setEvaluationDuration] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [requestedDocuments, setRequestedDocuments] = useState('');
  const [responding, setResponding] = useState<'accept' | 'reject' | ''>('');
  const [notice, setNotice] = useState('');

  const loadListings = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiClient.getLawyerCaseMarketplaceListings();
      const nextListings = response.data || [];
      setListings(nextListings);
      setSelected((current) => {
        if (!nextListings.length) return null;
        if (!current) return nextListings[0];
        return nextListings.find((item) => item.id === current.id) || nextListings[0];
      });
    } catch (err: any) {
      setError(err?.response?.data?.error || 'تعذر تحميل متجر القضايا.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setReviewChecked(Boolean(selected.offerStatus));
    setDecisionNote(selected.offerNote || '');
    setProposedPrice(selected.proposedPrice ? String(selected.proposedPrice) : selected.budget ? String(selected.budget) : '');
    setEvaluationDuration(selected.evaluationDuration || '');
    setPaymentMethod(selected.paymentMethod || '');
    setRequestedDocuments(selected.requestedDocuments || '');
  }, [selected?.id]);

  const stats = useMemo(() => {
    const open = listings.filter((item) => item.status === 'open').length;
    const unanswered = listings.filter((item) => !item.offerStatus && item.status === 'open').length;
    const suggested = listings.filter((item) => Boolean(item.suggested)).length;
    const accepted = listings.filter((item) => item.offerStatus === 'accepted').length;
    const bestScore = listings.reduce((max, item) => Math.max(max, getOpportunityScore(item)), 0);
    return { open, unanswered, suggested, accepted, bestScore };
  }, [listings]);

  const filteredListings = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return listings.filter((item) => {
      const matchesQuery =
        !normalizedQuery ||
        item.title?.toLowerCase().includes(normalizedQuery) ||
        item.category?.toLowerCase().includes(normalizedQuery) ||
        item.matter?.toLowerCase().includes(normalizedQuery) ||
        item.location?.toLowerCase().includes(normalizedQuery);
      const matchesFilter =
        filter === 'all' ||
        (filter === 'suggested' && Boolean(item.suggested)) ||
        (filter === 'nearby' && Boolean(item.nearby)) ||
        (filter === 'unanswered' && !item.offerStatus && item.status === 'open') ||
        (filter === 'reviewed' && Boolean(item.offerStatus));
      return matchesQuery && matchesFilter;
    }).sort((first, second) => getOpportunityScore(second) - getOpportunityScore(first));
  }, [filter, listings, query]);

  const selectListing = (item: CaseStoreListing) => {
    setSelected(item);
    setReviewChecked(Boolean(item.offerStatus));
    setDecisionNote(item.offerNote || '');
    setProposedPrice(item.proposedPrice ? String(item.proposedPrice) : item.budget ? String(item.budget) : '');
    setEvaluationDuration(item.evaluationDuration || '');
    setPaymentMethod(item.paymentMethod || '');
    setRequestedDocuments(item.requestedDocuments || '');
    setNotice('');
  };

  const respond = async (decision: 'accept' | 'reject') => {
    if (!selected) return;
    if (decision === 'accept' && !reviewChecked) {
      setNotice('راجع تفاصيل الدعوى والوثائق ثم أكد المراجعة قبل القبول.');
      return;
    }
    const normalizedPrice = Number(proposedPrice.replace(/[^\d.]/g, ''));
    if (decision === 'accept' && (!Number.isFinite(normalizedPrice) || normalizedPrice <= 0 || !evaluationDuration.trim() || !paymentMethod.trim())) {
      setNotice('أكمل السعر المقترح ومدة التقييم وطريقة الدفع قبل تقديم العرض.');
      return;
    }

    setResponding(decision);
    setNotice('');
    try {
      const response = await apiClient.respondToCaseMarketplaceListing(selected.id, {
        decision,
        note: decisionNote,
        proposedPrice: normalizedPrice,
        evaluationDuration,
        paymentMethod,
        requestedDocuments,
      });
      setNotice(response.message || (decision === 'accept' ? 'تم قبول الدعوى.' : 'تم تسجيل الرفض.'));
      await loadListings();
      if (decision === 'accept' && response.data?.case?.id) {
        navigate('/cases');
      }
    } catch (err: any) {
      setNotice(err?.response?.data?.error || 'تعذر حفظ القرار.');
    } finally {
      setResponding('');
    }
  };

  return (
    <main className="min-h-screen w-full bg-transparent text-right">
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <section className="overflow-hidden rounded-2xl bg-brand-navy text-white shadow-xl shadow-brand-navy/10">
          <div className="grid gap-6 p-5 sm:p-7 lg:grid-cols-[minmax(0,1fr)_360px] lg:p-8">
            <div className="flex flex-col items-end justify-between gap-6">
              <div>
                <p className="text-xs font-black text-brand-gold">Lawyer Opportunities</p>
                <h1 className="mt-3 text-3xl font-black leading-tight sm:text-4xl">فرص المحامين</h1>
                <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-white/70">
                  القضايا مرتبة حسب أفضل فرصة لك: القرب، ملاءمة التخصص، قوة الميزانية، وجاهزية ملف العميل.
                </p>
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-4">
                {[
                  ['متاحة', stats.open, 'fa-folder-open'],
                  ['بانتظارك', stats.unanswered, 'fa-hourglass-half'],
                  ['مقترحة', stats.suggested, 'fa-wand-magic-sparkles'],
                  ['أفضل فرصة', `${stats.bestScore}%`, 'fa-ranking-star'],
                ].map(([label, value, icon]) => (
                  <div key={String(label)} className="rounded-2xl bg-white/10 p-4">
                    <i className={`fa-solid ${icon} text-brand-gold`} />
                    <p className="mt-3 text-2xl font-black">{typeof value === 'number' ? value.toLocaleString('ar-IQ') : value}</p>
                    <p className="mt-1 text-xs font-bold text-white/60">{label}</p>
                  </div>
                ))}
              </div>
            </div>
            <aside className="rounded-2xl bg-white/10 p-5">
              <p className="text-sm font-black text-brand-gold">سير العمل الصحيح</p>
              <div className="mt-4 space-y-3">
                {['ابدأ بالأعلى درجة فرصة', 'راجع سبب الترشيح والجاهزية', 'قدّم عرضاً بسعر ومدة واضحين', 'اطلب الوثائق الناقصة قبل البدء'].map((item, index) => (
                  <div key={item} className="flex items-center justify-end gap-3 rounded-xl bg-white/10 p-3">
                    <p className="flex-1 text-sm font-bold text-white/80">{item}</p>
                    <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-brand-gold text-xs font-black text-brand-navy">{index + 1}</span>
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(360px,430px)_minmax(0,1fr)]">
          <aside className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row-reverse sm:items-center">
              <div className="relative flex-1">
                <i className="fa-solid fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  className="h-12 w-full rounded-xl bg-slate-50 pr-10 pl-4 text-sm font-bold text-brand-dark outline-none transition focus:bg-white focus:ring-4 focus:ring-brand-navy/10"
                  placeholder="ابحث بالتصنيف، المدينة، أو تفاصيل الدعوى"
                />
              </div>
              <button
                type="button"
                onClick={loadListings}
                className="flex h-12 items-center justify-center gap-2 rounded-xl bg-brand-navy px-4 text-xs font-black text-white transition hover:bg-brand-dark"
              >
                <i className="fa-solid fa-rotate-right" />
                تحديث
              </button>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5 lg:grid-cols-2">
              {filters.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFilter(item.id)}
                  className={`flex h-11 items-center justify-center gap-2 rounded-xl text-xs font-black transition ${
                    filter === item.id ? 'bg-brand-navy text-white shadow-sm' : 'bg-slate-50 text-slate-500 hover:bg-slate-100'
                  }`}
                >
                  <i className={`fa-solid ${item.icon} text-[11px]`} />
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-4 max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {loading ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center text-sm font-black text-slate-400">جار تحميل القضايا...</div>
              ) : error ? (
                <div className="rounded-2xl bg-red-50 p-5 text-sm font-black text-red-600">{error}</div>
              ) : filteredListings.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 p-8 text-center">
                  <i className="fa-solid fa-folder-open mb-3 block text-3xl text-slate-300" />
                  <p className="text-sm font-black text-slate-500">لا توجد قضايا مطابقة حالياً</p>
                </div>
              ) : (
                filteredListings.map((item) => {
                  const score = getOpportunityScore(item);
                  return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => selectListing(item)}
                    className={`w-full rounded-2xl p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                      selected?.id === item.id ? 'bg-brand-navy text-white' : 'bg-slate-50 text-slate-700 hover:bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <span className={`rounded-xl px-2.5 py-1 text-[10px] font-black ${selected?.id === item.id ? 'bg-white/15 text-brand-gold' : 'bg-white text-slate-500'}`}>
                        {score}% · {getOpportunityLabel(score)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-black ${selected?.id === item.id ? 'text-white' : 'text-brand-dark'}`}>{item.title}</p>
                        <p className={`mt-1 text-xs font-bold ${selected?.id === item.id ? 'text-white/60' : 'text-slate-500'}`}>
                          {formatMoney(item.budget)} · جاهزية {item.readiness || 0}%
                        </p>
                      </div>
                    </div>
                    <p className={`mt-3 line-clamp-2 text-xs font-bold leading-6 ${selected?.id === item.id ? 'text-white/65' : 'text-slate-500'}`}>{item.matter}</p>
                    <div className={`mt-3 h-2 overflow-hidden rounded-full ${selected?.id === item.id ? 'bg-white/15' : 'bg-white'}`}>
                      <div className="h-full rounded-full bg-brand-gold" style={{ width: `${score}%` }} />
                    </div>
                    <div className="mt-3 flex flex-wrap justify-end gap-2">
                      {getOpportunityReasons(item).slice(0, 3).map((reason) => (
                        <span key={reason} className={`rounded-lg px-2 py-1 text-[10px] font-black ${selected?.id === item.id ? 'bg-white/15 text-white/75' : 'bg-white text-slate-500'}`}>{reason}</span>
                      ))}
                      <span className={`rounded-lg px-2 py-1 text-[10px] font-black ${selected?.id === item.id ? 'bg-white/15 text-white/65' : 'bg-white text-slate-500'}`}>
                        {item.documents?.length || 0} وثائق
                      </span>
                    </div>
                  </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="min-h-[680px] rounded-2xl bg-white p-4 shadow-sm sm:p-6">
            {selected ? (
              <CaseReviewPanel
                listing={selected}
                reviewChecked={reviewChecked}
                setReviewChecked={setReviewChecked}
                decisionNote={decisionNote}
                setDecisionNote={setDecisionNote}
                proposedPrice={proposedPrice}
                setProposedPrice={setProposedPrice}
                evaluationDuration={evaluationDuration}
                setEvaluationDuration={setEvaluationDuration}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                requestedDocuments={requestedDocuments}
                setRequestedDocuments={setRequestedDocuments}
                notice={notice}
                responding={responding}
                onAccept={() => respond('accept')}
                onReject={() => respond('reject')}
              />
            ) : (
              <div className="flex min-h-[560px] flex-col items-center justify-center text-center">
                <i className="fa-solid fa-scale-balanced text-5xl text-slate-200" />
                <p className="mt-4 text-lg font-black text-brand-dark">اختر قضية لمراجعتها</p>
                <p className="mt-2 max-w-sm text-sm font-bold leading-6 text-slate-500">ستظهر هنا التفاصيل والوثائق وخيارات القبول أو الرفض.</p>
              </div>
            )}
          </section>
        </section>
      </div>
    </main>
  );
}

function CaseReviewPanel({
  listing,
  reviewChecked,
  setReviewChecked,
  decisionNote,
  setDecisionNote,
  proposedPrice,
  setProposedPrice,
  evaluationDuration,
  setEvaluationDuration,
  paymentMethod,
  setPaymentMethod,
  requestedDocuments,
  setRequestedDocuments,
  notice,
  responding,
  onAccept,
  onReject,
}: {
  listing: CaseStoreListing;
  reviewChecked: boolean;
  setReviewChecked: (value: boolean) => void;
  decisionNote: string;
  setDecisionNote: (value: string) => void;
  proposedPrice: string;
  setProposedPrice: (value: string) => void;
  evaluationDuration: string;
  setEvaluationDuration: (value: string) => void;
  paymentMethod: string;
  setPaymentMethod: (value: string) => void;
  requestedDocuments: string;
  setRequestedDocuments: (value: string) => void;
  notice: string;
  responding: 'accept' | 'reject' | '';
  onAccept: () => void;
  onReject: () => void;
}) {
  const alreadyReviewed = Boolean(listing.offerStatus);
  const score = getOpportunityScore(listing);
  const reasons = getOpportunityReasons(listing);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {Boolean(listing.suggested) && <Badge tone="gold" icon="fa-wand-magic-sparkles" label="مقترحة لتخصصك" />}
          {Boolean(listing.nearby) && <Badge tone="blue" icon="fa-location-dot" label="قريبة منك" />}
          <Badge tone={listing.offerStatus === 'accepted' ? 'green' : listing.offerStatus === 'rejected' ? 'red' : 'slate'} icon="fa-clipboard-check" label={offerLabel(listing.offerStatus)} />
        </div>
        <div>
          <p className="text-xs font-black text-brand-gold">{listing.category || 'دعوى عامة'}</p>
          <h2 className="mt-2 text-2xl font-black leading-tight text-brand-dark">{listing.title}</h2>
          <p className="mt-2 text-xs font-bold text-slate-400">{getAgeLabel(listing.createdAt)}</p>
        </div>
      </div>

      <section className="rounded-2xl bg-brand-navy p-5 text-white">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="text-left">
            <p className="text-3xl font-black text-brand-gold">{score}%</p>
            <p className="mt-1 text-xs font-black text-white/60">{getOpportunityLabel(score)}</p>
          </div>
          <div className="max-w-2xl text-right">
            <p className="text-sm font-black">لماذا هذه فرصة مناسبة؟</p>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              {reasons.map((reason) => (
                <span key={reason} className="rounded-xl bg-white/10 px-3 py-2 text-xs font-black text-white/75">{reason}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/15">
          <div className="h-full rounded-full bg-brand-gold" style={{ width: `${score}%` }} />
        </div>
      </section>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="المبلغ المقترح" value={formatMoney(listing.budget)} icon="fa-money-bill-wave" />
        <Metric label="جاهزية الملف" value={`${listing.readiness || 0}%`} icon="fa-gauge-high" />
        <Metric label="الوثائق" value={`${listing.documents?.length || 0}`} icon="fa-paperclip" />
        <Metric label="الموقع" value={listing.location || listing.clientLocation || 'غير محدد'} icon="fa-map-location-dot" />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <article className="rounded-2xl bg-slate-50 p-5">
          <p className="text-sm font-black text-brand-dark">تفاصيل الدعوى</p>
          <p className="mt-3 whitespace-pre-line text-sm font-bold leading-8 text-slate-600">{listing.matter}</p>
          {listing.notes ? (
            <div className="mt-4 rounded-xl bg-white p-4">
              <p className="text-xs font-black text-brand-gold">ملاحظات العميل</p>
              <p className="mt-2 text-sm font-bold leading-7 text-slate-600">{listing.notes}</p>
            </div>
          ) : null}
        </article>

        <aside className="rounded-2xl bg-[#fffaf0] p-5">
          <p className="text-sm font-black text-brand-dark">بيانات أولية</p>
          <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
            <InfoRow label="العميل" value={listing.clientName || 'عميل المنصة'} />
            <InfoRow label="مدينة العميل" value={listing.clientLocation || listing.location || 'غير محددة'} />
            <InfoRow label="الحالة" value={listing.status === 'open' ? 'مفتوحة' : 'تم إسنادها'} />
          </div>
        </aside>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-900/5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-xl bg-slate-50 px-3 py-2 text-xs font-black text-slate-500">{listing.documents?.length || 0} ملف</span>
          <h3 className="text-lg font-black text-brand-dark">وثائق المراجعة</h3>
        </div>
        {listing.documents?.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {listing.documents.map((doc, index) => (
              <a
                key={`${doc.url || doc.name}-${index}`}
                href={doc.url || '#'}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-4 transition hover:bg-brand-navy hover:text-white"
              >
                <i className="fa-solid fa-arrow-up-right-from-square text-xs opacity-60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black">{doc.name || `وثيقة ${index + 1}`}</p>
                  <p className="mt-1 text-xs font-bold opacity-60">{doc.mimeType || 'ملف مرفوع'}</p>
                </div>
                <i className="fa-solid fa-file-lines text-brand-gold" />
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-xl bg-slate-50 p-6 text-center text-sm font-bold text-slate-400">لا توجد وثائق مرفوعة لهذه الدعوى.</div>
        )}
      </section>

      <section className="rounded-2xl bg-slate-50 p-5">
        <label className="flex cursor-pointer flex-row-reverse items-start gap-3 rounded-xl bg-white p-4">
          <input
            type="checkbox"
            checked={reviewChecked}
            disabled={alreadyReviewed}
            onChange={(event) => setReviewChecked(event.target.checked)}
            className="mt-1 h-5 w-5 rounded text-brand-navy"
          />
          <span>
            <span className="block text-sm font-black text-brand-dark">راجعت تفاصيل الدعوى والوثائق والمبلغ المقترح</span>
            <span className="mt-1 block text-xs font-bold leading-6 text-slate-500">هذا التأكيد مطلوب قبل قبول الدعوى حتى لا تتحول إلى ملف قضية قبل مراجعتها.</span>
          </span>
        </label>

        <textarea
          value={decisionNote}
          onChange={(event) => setDecisionNote(event.target.value)}
          disabled={alreadyReviewed}
          rows={4}
          className="mt-4 w-full resize-none rounded-xl bg-white p-4 text-sm font-bold leading-7 text-slate-700 outline-none focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
          placeholder="ملاحظة للعميل: سبب القبول، المتطلبات الناقصة، أو سبب الرفض..."
        />

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <label className="block">
            <span className="mb-2 block text-xs font-black text-slate-500">السعر المقترح</span>
            <input
              value={proposedPrice}
              onChange={(event) => setProposedPrice(event.target.value)}
              disabled={alreadyReviewed}
              inputMode="numeric"
              className="h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
              placeholder="مثال: 500000"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black text-slate-500">مدة التقييم</span>
            <input
              value={evaluationDuration}
              onChange={(event) => setEvaluationDuration(event.target.value)}
              disabled={alreadyReviewed}
              className="h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
              placeholder="مثال: 48 ساعة"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-black text-slate-500">طريقة الدفع</span>
            <input
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
              disabled={alreadyReviewed}
              className="h-12 w-full rounded-xl bg-white px-4 text-sm font-black text-brand-dark outline-none focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
              placeholder="دفعة واحدة أو أقساط"
            />
          </label>
        </div>

        <textarea
          value={requestedDocuments}
          onChange={(event) => setRequestedDocuments(event.target.value)}
          disabled={alreadyReviewed}
          rows={3}
          className="mt-3 w-full resize-none rounded-xl bg-white p-4 text-sm font-bold leading-7 text-slate-700 outline-none focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
          placeholder="وثائق إضافية مطلوبة من العميل قبل البدء..."
        />

        {notice && <p className="mt-3 rounded-xl bg-white px-4 py-3 text-sm font-black text-brand-navy">{notice}</p>}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={onReject}
            disabled={alreadyReviewed || Boolean(responding)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-red-50 px-4 text-sm font-black text-red-600 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <i className="fa-solid fa-xmark" />
            {responding === 'reject' ? 'جار تسجيل الرفض...' : 'رفض الدعوى'}
          </button>
          <button
            type="button"
            onClick={onAccept}
            disabled={alreadyReviewed || Boolean(responding)}
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <i className="fa-solid fa-check" />
            {responding === 'accept' ? 'جار قبول الدعوى...' : 'قبول وإنشاء ملف قضية'}
          </button>
        </div>
      </section>
    </div>
  );
}

function Metric({ label, value, icon }: { label: string; value: string; icon: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <i className={`fa-solid ${icon} text-brand-gold`} />
      <p className="mt-3 truncate text-lg font-black text-brand-dark">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-400">{label}</p>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-slate-500">{value}</span>
      <span className="font-black text-brand-dark">{label}</span>
    </div>
  );
}

function Badge({ tone, icon, label }: { tone: 'gold' | 'blue' | 'green' | 'red' | 'slate'; icon: string; label: string }) {
  const classes = {
    gold: 'bg-brand-gold/15 text-brand-gold',
    blue: 'bg-blue-50 text-blue-700',
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black ${classes[tone]}`}>
      <i className={`fa-solid ${icon} text-[10px]`} />
      {label}
    </span>
  );
}
