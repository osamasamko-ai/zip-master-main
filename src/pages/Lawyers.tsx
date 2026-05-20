import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import FollowButton from '../components/FollowButton';
import StatusBadge from '../components/ui/StatusBadge';
import apiClient from '../api/client';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';

const CONSULTATION_PAYMENT_METHODS = [
  { id: 'zain-cash', label: 'زين كاش', subtitle: 'تأكيد فوري وآمن', recommended: true },
  { id: 'card', label: 'بطاقة مصرفية', subtitle: 'Visa / Mastercard' },
  { id: 'bank-transfer', label: 'تحويل بنكي', subtitle: 'إشعار دفع إلكتروني' },
];

function parseConsultationFee(value: string) {
  const amount = Number(value.replace(/[^\d.]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

type LawyerItem = {
  id: string;
  name: string;
  specialty: string;
  location: string;
  experience: string;
  experienceYears: number;
  availability: string;
  isOnline: boolean;
  rating: number;
  reviews: string;
  reviewCount: number;
  casesHandled: string;
  consultationFee: string;
  verified: boolean;
  accent: string;
  avatar: string;
  tagline: string;
  followers: number;
  responseTime: string;
};

type SortMode = 'best' | 'rating' | 'response';

export default function Lawyers() {
  const navigate = useNavigate();
  const { followedIds, isPending, toggleFollow } = useFollowedLawyers();
  const [lawyers, setLawyers] = useState<LawyerItem[]>([]);
  const [query, setQuery] = useState('');
  const [specialty, setSpecialty] = useState('الكل');
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [onlineOnly, setOnlineOnly] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>('best');
  const [selectedLawyerId, setSelectedLawyerId] = useState('');
  const [isLoadingLawyers, setIsLoadingLawyers] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [consultationLawyer, setConsultationLawyer] = useState<LawyerItem | null>(null);
  const [consultationNote, setConsultationNote] = useState('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState(CONSULTATION_PAYMENT_METHODS[0].id);
  const [isStartingConsultation, setIsStartingConsultation] = useState(false);
  const [consultationError, setConsultationError] = useState('');
  const [consultationSuccess, setConsultationSuccess] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsLoadingLawyers(true);
      setLoadError('');
      try {
        const response = await apiClient.getLawyers();
        setLawyers(response.data || []);
        setSelectedLawyerId((response.data || [])[0]?.id || '');
      } catch (error) {
        console.error('Failed to load lawyers', error);
        setLoadError('تعذر تحميل قائمة المحامين حالياً. حاول تحديث الصفحة.');
      } finally {
        setIsLoadingLawyers(false);
      }
    };

    load();
  }, []);

  useEffect(() => {
    const handleFollowStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lawyerId: string; followerCount?: number; delta: number }>;
      const { lawyerId, followerCount, delta } = customEvent.detail;

      setLawyers((current) =>
        current.map((lawyer) =>
          lawyer.id === lawyerId
            ? {
              ...lawyer,
              followers: typeof followerCount === 'number' ? followerCount : Math.max(0, lawyer.followers + delta),
            }
            : lawyer,
        ),
      );
    };

    window.addEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
  }, []);

  const specialties = useMemo(
    () => ['الكل', ...Array.from(new Set(lawyers.map((lawyer) => lawyer.specialty)))],
    [lawyers],
  );

  const filteredLawyers = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const next = lawyers.filter((lawyer) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        lawyer.name.toLowerCase().includes(normalizedQuery) ||
        lawyer.specialty.toLowerCase().includes(normalizedQuery) ||
        lawyer.location.toLowerCase().includes(normalizedQuery);
      const matchesSpecialty = specialty === 'الكل' || lawyer.specialty === specialty;
      const matchesVerified = !verifiedOnly || lawyer.verified;
      const matchesOnline = !onlineOnly || lawyer.isOnline;

      return matchesQuery && matchesSpecialty && matchesVerified && matchesOnline;
    });

    return next.sort((left, right) => {
      if (sortMode === 'rating') return right.rating - left.rating;
      if (sortMode === 'response') return Number(right.isOnline) - Number(left.isOnline) || right.followers - left.followers;

      const leftFollowed = followedIds.includes(left.id) ? 1 : 0;
      const rightFollowed = followedIds.includes(right.id) ? 1 : 0;
      if (leftFollowed !== rightFollowed) return rightFollowed - leftFollowed;
      if (left.verified !== right.verified) return Number(right.verified) - Number(left.verified);
      if (left.isOnline !== right.isOnline) return Number(right.isOnline) - Number(left.isOnline);
      return right.rating - left.rating;
    });
  }, [followedIds, lawyers, onlineOnly, query, sortMode, specialty, verifiedOnly]);

  useEffect(() => {
    if (!filteredLawyers.some((lawyer) => lawyer.id === selectedLawyerId)) {
      setSelectedLawyerId(filteredLawyers[0]?.id || '');
    }
  }, [filteredLawyers, selectedLawyerId]);

  const selectedLawyer = filteredLawyers.find((lawyer) => lawyer.id === selectedLawyerId) || filteredLawyers[0] || null;
  const recommendedLawyer = filteredLawyers[0] || null;
  const activeFilterCount = [
    query.trim().length > 0,
    specialty !== 'الكل',
    verifiedOnly,
    onlineOnly,
    sortMode !== 'best',
  ].filter(Boolean).length;
  const onlineCount = filteredLawyers.filter((lawyer) => lawyer.isOnline).length;
  const verifiedCount = filteredLawyers.filter((lawyer) => lawyer.verified).length;
  const highestRatedLawyer = filteredLawyers.reduce<LawyerItem | null>(
    (best, lawyer) => (!best || lawyer.rating > best.rating ? lawyer : best),
    null,
  );

  const resetFilters = () => {
    setQuery('');
    setSpecialty('الكل');
    setVerifiedOnly(false);
    setOnlineOnly(false);
    setSortMode('best');
  };

  const handleOpenCase = (lawyer: LawyerItem) => {
    navigate('/cases', { state: { openNewCase: true, preselectedLawyerId: lawyer.id } });
  };

  const handleOpenConsultation = (lawyer: LawyerItem) => {
    setConsultationLawyer(lawyer);
    setConsultationNote('');
    setSelectedPaymentMethod(CONSULTATION_PAYMENT_METHODS[0].id);
    setConsultationError('');
  };

  const handleContact = (lawyer: LawyerItem) => {
    navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`);
  };

  const handleStartConsultation = async () => {
    if (!consultationLawyer) return;

    setIsStartingConsultation(true);
    setConsultationError('');

    try {
      const selectedMethod = CONSULTATION_PAYMENT_METHODS.find((item) => item.id === selectedPaymentMethod);
      const response = await apiClient.startLawyerConsultation(consultationLawyer.id, {
        paymentMethod: selectedMethod?.label || selectedPaymentMethod,
        note: consultationNote.trim() || undefined,
      });

      const redirectTo = response.data?.redirectTo;
      setConsultationSuccess(`تم تأكيد الدفع وفتح استشارة جديدة مع ${consultationLawyer.name}.`);

      window.setTimeout(() => {
        navigate(redirectTo || `/messages?lawyerId=${encodeURIComponent(consultationLawyer.id)}`);
      }, 700);
    } catch (error: any) {
      setConsultationError(error?.response?.data?.error || 'تعذر بدء الاستشارة حالياً. حاول مرة أخرى.');
    } finally {
      setIsStartingConsultation(false);
    }
  };

  const selectedConsultationAmount = consultationLawyer ? parseConsultationFee(consultationLawyer.consultationFee) : 0;

  return (
    <div className="app-view fade-in mx-auto max-w-[1440px] space-y-6 pb-12 text-right">
      <section className="overflow-hidden rounded-[2.25rem] border border-white/70 bg-white/80 shadow-premium backdrop-blur">
        <div className="grid gap-0 xl:grid-cols-[minmax(0,1fr)_420px]">
          <div className="p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
              <i className="fa-solid fa-scale-balanced"></i>
              دليل المحامين
            </div>
            <h1 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-brand-dark md:text-4xl">ابحث عن المحامي المناسب، ثم ابدأ الإجراء من نفس المكان</h1>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              فلترة سريعة حسب التخصص والتوفر، مقارنة واضحة للتقييم والاستجابة، وخيارات مباشرة للاستشارة أو فتح قضية.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">أفضل تطابق</p>
                <p className="mt-1 truncate text-sm font-black text-brand-dark">{recommendedLawyer?.name || 'بانتظار النتائج'}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">أعلى تقييم</p>
                <p className="mt-1 truncate text-sm font-black text-brand-dark">{highestRatedLawyer ? `${highestRatedLawyer.name} • ${highestRatedLawyer.rating.toFixed(1)}` : 'لا يوجد'}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white px-4 py-3 shadow-sm">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">فلاتر نشطة</p>
                <p className="mt-1 text-sm font-black text-brand-dark">{activeFilterCount.toLocaleString('ar-IQ')}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-100 bg-[linear-gradient(135deg,#0B132B,#1A237E)] p-6 text-white xl:border-r xl:border-t-0 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-lightgold">Directory Pulse</p>
            <div className="mt-5 grid grid-cols-3 gap-3">
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">النتائج</p>
                <p className="mt-2 text-3xl font-black">{filteredLawyers.length.toLocaleString('ar-IQ')}</p>
                <p className="mt-1 text-xs font-bold text-white/60">مطابقة</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">متاحون</p>
                <p className="mt-2 text-3xl font-black">{onlineCount.toLocaleString('ar-IQ')}</p>
                <p className="mt-1 text-xs font-bold text-white/60">الآن</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <p className="text-[11px] font-black uppercase tracking-widest text-white/60">موثقون</p>
                <p className="mt-2 text-3xl font-black">{verifiedCount.toLocaleString('ar-IQ')}</p>
                <p className="mt-1 text-xs font-bold text-white/60">ضمن النتائج</p>
              </div>
            </div>

            {recommendedLawyer && (
              <button
                type="button"
                onClick={() => setSelectedLawyerId(recommendedLawyer.id)}
                className="mt-5 flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/10 bg-white/10 p-4 text-right transition hover:bg-white/15"
              >
                <span className="rounded-full bg-brand-gold px-3 py-1 text-[10px] font-black text-brand-dark">مقترح</span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-black">{recommendedLawyer.name}</p>
                  <p className="mt-1 truncate text-xs font-bold text-white/65">{recommendedLawyer.specialty} • {recommendedLawyer.responseTime}</p>
                </div>
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
              <label className="text-right">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">ابحث بالمشكلة أو الاسم</span>
                <div className="relative">
                  <input
                    type="search"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="مثال: عقارات، ملكية فكرية، بغداد"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                  />
                  <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
                </div>
              </label>

              <label className="text-right">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">التخصص</span>
                <select
                  value={specialty}
                  onChange={(event) => setSpecialty(event.target.value)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                >
                  {specialties.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="text-right">
                <span className="mb-2 block text-[11px] font-black uppercase tracking-widest text-slate-400">ترتيب النتائج</span>
                <select
                  value={sortMode}
                  onChange={(event) => setSortMode(event.target.value as SortMode)}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
                >
                  <option value="best">أفضل تطابق</option>
                  <option value="rating">الأعلى تقييماً</option>
                  <option value="response">الأسرع تفاعلاً</option>
                </select>
              </label>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {specialties.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setSpecialty(item)}
                  className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${specialty === item ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy hover:bg-white hover:text-brand-navy'}`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {activeFilterCount > 0 && (
                  <span className="rounded-full bg-brand-navy/5 px-3 py-2 text-[10px] font-black text-brand-navy">
                    {activeFilterCount.toLocaleString('ar-IQ')} فلتر نشط
                  </span>
                )}
                {query.trim() && (
                  <span className="rounded-full bg-slate-100 px-3 py-2 text-[10px] font-black text-slate-500">بحث: {query.trim()}</span>
                )}
              </div>
              <div className="flex flex-wrap justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setVerifiedOnly((current) => !current)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${verifiedOnly ? 'bg-brand-navy text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  المحامون الموثقون فقط
                </button>
                <button
                  type="button"
                  onClick={() => setOnlineOnly((current) => !current)}
                  className={`rounded-full px-4 py-2 text-xs font-black transition ${onlineOnly ? 'bg-emerald-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                >
                  المتاحون الآن
                </button>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 transition hover:border-brand-navy hover:text-brand-navy"
                >
                  مسح الفلاتر
                </button>
              </div>
            </div>
          </section>

          {loadError ? (
            <EmptyState
              icon="triangle-exclamation"
              title="تعذر تحميل المحامين"
              description={loadError}
              action={<ActionButton variant="primary" onClick={() => window.location.reload()}>تحديث الصفحة</ActionButton>}
            />
          ) : isLoadingLawyers ? (
            <div className="grid gap-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="animate-pulse space-y-5">
                    <div className="flex items-start gap-4">
                      <div className="h-20 w-20 rounded-[1.75rem] bg-slate-100"></div>
                      <div className="flex-1 space-y-3">
                        <div className="h-4 w-1/3 rounded bg-slate-100"></div>
                        <div className="h-3 w-2/3 rounded bg-slate-100"></div>
                        <div className="h-3 w-1/2 rounded bg-slate-100"></div>
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4">
                      <div className="h-16 rounded-2xl bg-slate-100"></div>
                      <div className="h-16 rounded-2xl bg-slate-100"></div>
                      <div className="h-16 rounded-2xl bg-slate-100"></div>
                      <div className="h-16 rounded-2xl bg-slate-100"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredLawyers.length > 0 ? (
            <div className="grid gap-4">
              {filteredLawyers.map((lawyer, index) => (
                <article
                  key={lawyer.id}
                  className={`relative overflow-hidden rounded-[2rem] border bg-white p-5 text-right shadow-sm transition ${selectedLawyer?.id === lawyer.id ? 'border-brand-navy shadow-lg shadow-brand-navy/10' : 'border-slate-200 hover:border-brand-navy/30 hover:shadow-md'}`}
                >
                  <div className={`absolute inset-y-0 right-0 w-1.5 ${selectedLawyer?.id === lawyer.id ? 'bg-brand-navy' : 'bg-transparent'}`}></div>
                  <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className="relative shrink-0 cursor-pointer"
                        onClick={() => navigate(`/profile/${lawyer.id}`)}
                        title="عرض الملف"
                      >
                        <img src={lawyer.avatar} alt={lawyer.name} className="h-20 w-20 rounded-[1.75rem] object-cover shadow-sm ring-4 ring-slate-50" />
                        {lawyer.isOnline && <span className="absolute bottom-1 left-1 h-3.5 w-3.5 rounded-full border-2 border-white bg-emerald-500"></span>}
                      </div>
                      <div className="min-w-0 space-y-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          {index === 0 && sortMode === 'best' && <StatusBadge tone="warning">أفضل تطابق</StatusBadge>}
                          {lawyer.verified && <StatusBadge tone="info">موثق</StatusBadge>}
                          {followedIds.includes(lawyer.id) && <StatusBadge tone="warning">محفوظ</StatusBadge>}
                          <StatusBadge tone={lawyer.isOnline ? 'success' : 'neutral'}>
                            {lawyer.isOnline ? 'متاح الآن' : 'متاح حسب الجدول'}
                          </StatusBadge>
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-brand-dark">{lawyer.name}</h3>
                          <p className="mt-1 text-sm font-bold text-slate-500">{lawyer.tagline}</p>
                        </div>
                        <div className="flex flex-wrap items-center justify-end gap-3 text-xs font-black text-slate-500">
                          <span>{lawyer.specialty}</span>
                          <span>{lawyer.location}</span>
                          <span>{lawyer.responseTime}</span>
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedLawyerId(lawyer.id)}
                      className={`rounded-2xl border px-4 py-3 text-xs font-black transition ${selectedLawyer?.id === lawyer.id ? 'border-brand-navy bg-brand-navy text-white' : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy hover:bg-white hover:text-brand-navy'}`}
                    >
                      {selectedLawyer?.id === lawyer.id ? 'معروض في الملخص' : 'عرض الملخص'}
                    </button>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">التقييم</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.rating.toFixed(1)} • {lawyer.reviewCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">الاستجابة</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.responseTime}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">الخبرة</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.experience}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">الاستشارة</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.consultationFee}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-4">
                    <ActionButton onClick={() => handleOpenConsultation(lawyer)} variant="primary" className="w-full">
                      <i className="fa-solid fa-credit-card"></i>
                      ابدأ استشارة
                    </ActionButton>
                    <ActionButton onClick={() => handleOpenCase(lawyer)} variant="secondary" className="w-full">
                      <i className="fa-solid fa-folder-plus"></i>
                      افتح قضية
                    </ActionButton>
                    <FollowButton
                      isFollowing={followedIds.includes(lawyer.id)}
                      isLoading={isPending(lawyer.id)}
                      onToggle={() => toggleFollow(lawyer.id)}
                      className="w-full"
                    />
                    <ActionButton onClick={() => handleContact(lawyer)} variant="ghost" className="w-full">
                      رسالة مباشرة
                    </ActionButton>
                  </div>

                  <div className="mt-4 rounded-[1.6rem] border border-slate-200 bg-[linear-gradient(135deg,rgba(248,250,252,1),rgba(255,255,255,1))] px-4 py-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="text-right">
                        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">أفضل خطوة الآن</p>
                        <p className="mt-1 text-sm font-black text-brand-dark">
                          {lawyer.isOnline ? 'ابدأ برسالة سريعة لمعرفة التوفر الفوري.' : 'افتح ملفاً جديداً لتثبيت الطلب ومشاركة التفاصيل.'}
                        </p>
                      </div>
                      <span className={`rounded-full px-3 py-1 text-[10px] font-black ${lawyer.isOnline ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {lawyer.isOnline ? 'رد أسرع متوقع' : 'ابدأ بتنظيم الطلب'}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full bg-brand-gold transition-all"
                        style={{ width: `${Math.min(100, Math.round((lawyer.rating / 5) * 72 + (lawyer.isOnline ? 14 : 0) + (lawyer.verified ? 14 : 0)))}%` }}
                      ></div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="scale-balanced"
              title="لا توجد نتائج مطابقة"
              description="جرّب تغيير الكلمات المفتاحية أو مسح الفلاتر للوصول إلى محامين أكثر."
              action={
                <ActionButton
                  onClick={() => {
                    resetFilters();
                  }}
                  variant="primary"
                >
                  مسح الفلاتر
                </ActionButton>
              }
            />
          )}
        </div>

        <aside className="space-y-4">
          <section className="sticky top-24 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-black text-brand-dark">ملخص سريع</h2>
            <p className="mt-1 text-xs font-bold text-slate-500">كل ما تحتاجه لاتخاذ القرار ثم الانتقال للإجراء التالي مباشرة.</p>

            {selectedLawyer ? (
              <div className="mt-4 space-y-4">
                <div className={`rounded-[1.75rem] bg-gradient-to-br ${selectedLawyer.accent} p-5 text-white`}>
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-white/70">Top Match</p>
                  <p className="mt-3 text-2xl font-black">{selectedLawyer.name}</p>
                  <p className="mt-1 text-sm font-bold text-white/80">{selectedLawyer.tagline}</p>
                  <div className="mt-4 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3 text-sm font-black">
                    <span>{selectedLawyer.consultationFee}</span>
                    <span>{selectedLawyer.rating.toFixed(1)} / 5</span>
                  </div>
                </div>

                <div className="grid gap-3">
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-black text-slate-400">التخصص</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">{selectedLawyer.specialty}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-black text-slate-400">أفضل خطوة الآن</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">
                      {selectedLawyer.isOnline ? 'ابدأ رسالة مباشرة الآن' : 'افتح قضية وحدد هذا المحامي من البداية'}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-[11px] font-black text-slate-400">الدليل الاجتماعي</p>
                    <p className="mt-1 text-sm font-black text-brand-dark">{selectedLawyer.followers.toLocaleString('ar-IQ')} متابع</p>
                  </div>
                </div>

                <div className="grid gap-3">
                  <ActionButton onClick={() => handleOpenConsultation(selectedLawyer)} variant="primary" className="w-full">
                    ابدأ استشارة مدفوعة
                  </ActionButton>
                  <ActionButton onClick={() => handleOpenCase(selectedLawyer)} variant="secondary" className="w-full">
                    افتح قضية مع هذا المحامي
                  </ActionButton>
                  <ActionButton onClick={() => navigate(`/profile/${selectedLawyer.id}`)} variant="ghost" className="w-full">
                    عرض الملف الكامل
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-8 text-center text-sm font-bold text-slate-400">
                اختر محامياً لعرض الملخص السريع.
              </div>
            )}
          </section>
        </aside>
      </section>

      <AnimatePresence>
        {consultationLawyer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[250] flex items-center justify-center bg-brand-dark/45 backdrop-blur-sm px-4"
          >
            <button
              type="button"
              onClick={() => !isStartingConsultation && setConsultationLawyer(null)}
              className="absolute inset-0"
              aria-label="إغلاق نافذة الاستشارة"
            />

            <motion.div
              initial={{ y: 16, scale: 0.98, opacity: 0 }}
              animate={{ y: 0, scale: 1, opacity: 1 }}
              exit={{ y: 16, scale: 0.98, opacity: 0 }}
              className="relative z-[251] w-full max-w-2xl rounded-[2.25rem] border border-white/70 bg-white p-7 shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => !isStartingConsultation && setConsultationLawyer(null)}
                  className="h-10 w-10 rounded-2xl bg-slate-50 text-slate-400 transition hover:text-red-500"
                >
                  <i className="fa-solid fa-times"></i>
                </button>
                <div className="text-right">
                  <p className="text-xs font-black uppercase tracking-[0.24em] text-brand-gold">Consultation Checkout</p>
                  <h2 className="mt-2 text-2xl font-black text-brand-dark">ابدأ الاستشارة خلال أقل من دقيقة</h2>
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                    سعر واضح، دفع فوري، ثم يتم إنشاء المحادثة تلقائياً وتحويلك مباشرة إلى شاشة الرسائل.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
                <div className="rounded-[1.75rem] bg-gradient-to-br from-brand-dark via-brand-navy to-slate-800 p-5 text-white">
                  <div className="flex items-center gap-3">
                    <img src={consultationLawyer.avatar} alt={consultationLawyer.name} className="h-16 w-16 rounded-[1.25rem] object-cover shadow-lg" />
                    <div className="text-right">
                      <p className="text-lg font-black">{consultationLawyer.name}</p>
                      <p className="mt-1 text-xs font-bold text-white/75">{consultationLawyer.specialty}</p>
                    </div>
                  </div>

                  <div className="mt-5 rounded-[1.5rem] bg-white/10 p-4">
                    <p className="text-[11px] font-black uppercase tracking-widest text-white/70">سعر الاستشارة</p>
                    <p className="mt-2 text-3xl font-black">{consultationLawyer.consultationFee}</p>
                    <p className="mt-2 text-xs font-bold text-white/75">يشمل فتح المحادثة الخاصة والرد الأولي الفوري داخل المنصة.</p>
                  </div>

                  <div className="mt-4 space-y-2 text-right text-xs font-bold text-white/80">
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span>التأكيد</span>
                      <span>فوري</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span>قناة التواصل</span>
                      <span>محادثة خاصة</span>
                    </div>
                    <div className="flex items-center justify-between rounded-2xl bg-white/10 px-3 py-2">
                      <span>اسم الملف</span>
                      <span>استشارة</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black text-emerald-700">دفع آمن</span>
                      <p className="text-sm font-black text-brand-dark">اختر طريقة الدفع</p>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {CONSULTATION_PAYMENT_METHODS.map((method) => (
                        <button
                          key={method.id}
                          type="button"
                          onClick={() => setSelectedPaymentMethod(method.id)}
                          className={`rounded-2xl border px-4 py-3 text-right transition ${selectedPaymentMethod === method.id
                            ? 'border-brand-navy bg-white shadow-sm'
                            : 'border-slate-200 bg-white/70 hover:border-brand-navy/30'}`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            {method.recommended ? (
                              <span className="rounded-full bg-brand-gold/10 px-2.5 py-1 text-[10px] font-black text-brand-gold">موصى به</span>
                            ) : (
                              <span className="text-[10px] font-black text-slate-300">طريقة دفع</span>
                            )}
                            <div className="text-right">
                              <p className="text-sm font-black text-brand-dark">{method.label}</p>
                              <p className="mt-1 text-[11px] font-bold text-slate-500">{method.subtitle}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[1.5rem] border border-slate-200 bg-white p-4">
                    <p className="text-sm font-black text-brand-dark">رسالة البدء للمحامي</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-500">اختياري، لكن يسرّع بدء الاستشارة ويمنح المحامي سياقاً مباشراً.</p>
                    <textarea
                      value={consultationNote}
                      onChange={(event) => setConsultationNote(event.target.value)}
                      placeholder="مثال: أحتاج استشارة عاجلة حول عقد إيجار تجاري وأرغب بمعرفة الخطوة القانونية الأولى."
                      className="mt-3 h-28 w-full rounded-[1.25rem] border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-brand-navy focus:bg-white resize-none"
                    />
                  </div>

                  {consultationError && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-black text-red-700">
                      {consultationError}
                    </div>
                  )}

                  {consultationSuccess && (
                    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-black text-emerald-700">
                      {consultationSuccess}
                    </div>
                  )}

                  <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                    <div className="flex items-center justify-between text-sm font-black text-brand-dark">
                      <span>{consultationLawyer.consultationFee}</span>
                      <span>إجمالي الدفع الآن</span>
                    </div>
                    <p className="mt-2 text-[11px] font-bold text-slate-500">
                      بالضغط على زر التأكيد سيتم إنشاء ملف باسم الاستشارة، تسجيل عملية الدفع، وفتح المحادثة مباشرة.
                    </p>

                    <div className="mt-4 flex gap-3">
                      <ActionButton
                        onClick={() => setConsultationLawyer(null)}
                        variant="ghost"
                        className="flex-1"
                        disabled={isStartingConsultation}
                      >
                        إلغاء
                      </ActionButton>
                      <ActionButton
                        onClick={handleStartConsultation}
                        variant="primary"
                        className="flex-[2]"
                        disabled={isStartingConsultation || selectedConsultationAmount <= 0}
                      >
                        <i className={`fa-solid ${isStartingConsultation ? 'fa-spinner fa-spin' : 'fa-lock'}`}></i>
                        {isStartingConsultation ? 'جارٍ تأكيد الدفع...' : 'ادفع وابدأ المحادثة'}
                      </ActionButton>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
