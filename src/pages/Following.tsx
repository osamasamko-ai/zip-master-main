import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FollowButton from '../components/FollowButton';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import StatusBadge from '../components/ui/StatusBadge';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';
import apiClient from '../api/client';

interface AvailabilityAlert {
  id: number;
  lawyerName: string;
  lawyerId: string;
  message: string;
  time: string;
}

type AvailabilityFilter = 'all' | 'online' | 'offline';
type FollowedSortMode = 'priority' | 'rating' | 'followers';

export default function Following() {
  const navigate = useNavigate();
  const {
    followedIds,
    follow,
    unfollow,
    isFollowed,
    isPending,
    totalFollowed,
    isLoading: isLoadingFollowState,
    reload,
  } = useFollowedLawyers();
  const [followedSearch, setFollowedSearch] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<AvailabilityFilter>('all');
  const [specialtyFilter, setSpecialtyFilter] = useState('all');
  const [sortMode, setSortMode] = useState<FollowedSortMode>('priority');
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [loadWarning, setLoadWarning] = useState('');
  const [alerts, setAlerts] = useState<AvailabilityAlert[]>([]);
  const [activeToast, setActiveToast] = useState<AvailabilityAlert | null>(null);
  const [allLawyers, setAllLawyers] = useState<any[]>([]);
  const [pageFollowedIds, setPageFollowedIds] = useState<string[]>([]);

  const loadPageData = useCallback(async () => {
    setIsLoading(true);
    setLoadError('');
    setLoadWarning('');
    try {
      const [lawyersResponse, followingResponse] = await Promise.allSettled([
        apiClient.getLawyers(),
        apiClient.getFollowing(),
      ]);

      const directoryLawyers = lawyersResponse.status === 'fulfilled' ? lawyersResponse.value.data || [] : [];
      const followedLawyersFromApi = followingResponse.status === 'fulfilled' ? followingResponse.value.data || [] : [];
      if (followingResponse.status === 'fulfilled') {
        setPageFollowedIds(followedLawyersFromApi.map((lawyer: any) => lawyer.id));
      }
      const mergedLawyers = [
        ...directoryLawyers,
        ...followedLawyersFromApi.filter((followedLawyer: any) => !directoryLawyers.some((lawyer: any) => lawyer.id === followedLawyer.id)),
      ];

      if (lawyersResponse.status === 'rejected' && followingResponse.status === 'rejected') {
        throw new Error('Failed to load directory and following data');
      }

      setAllLawyers(mergedLawyers);

      if (lawyersResponse.status === 'rejected') {
        setLoadWarning('تم تحميل المحفوظات، لكن تعذر تحميل المقترحين حالياً.');
      }
    } catch (error) {
      console.error('Failed to load following page data', error);
      setLoadError('تعذر تحميل المحامين المحفوظين حالياً. حاول تحديث الصفحة أو الرجوع إلى دليل المحامين.');
      setAllLawyers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPageData();
  }, [loadPageData]);

  const retryLoad = async () => {
    await Promise.all([loadPageData(), reload()]);
  };

  useEffect(() => {
    const handleFollowStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lawyerId: string; delta: number; followerCount?: number }>;
      const { lawyerId, delta, followerCount } = customEvent.detail;

      setPageFollowedIds((current) => {
        if (delta > 0) return current.includes(lawyerId) ? current : [...current, lawyerId];
        if (delta < 0) return current.filter((id) => id !== lawyerId);
        return current;
      });

      setAllLawyers((current) =>
        current.map((lawyer) =>
          lawyer.id === lawyerId
            ? {
                ...lawyer,
                followers: typeof followerCount === 'number' ? followerCount : Math.max(0, (lawyer.followers ?? 0) + delta),
              }
            : lawyer,
        ),
      );
    };

    window.addEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
  }, []);

  const effectiveFollowedIds = isLoadingFollowState || (followedIds.length === 0 && pageFollowedIds.length > 0)
    ? pageFollowedIds
    : followedIds;
  const displayedTotalFollowed = Math.max(totalFollowed, effectiveFollowedIds.length);

  const savedLawyers = useMemo(
    () => allLawyers.filter((lawyer) => effectiveFollowedIds.includes(lawyer.id)),
    [allLawyers, effectiveFollowedIds],
  );

  const specialties = useMemo(
    () => ['all', ...Array.from(new Set(savedLawyers.map((lawyer) => lawyer.specialty).filter(Boolean)))],
    [savedLawyers],
  );

  const followedLawyers = useMemo(() => {
    const normalizedSearch = followedSearch.trim().toLowerCase();
    return savedLawyers
      .filter((lawyer) => {
        const matchesSearch =
          normalizedSearch.length === 0 ||
          lawyer.name.toLowerCase().includes(normalizedSearch) ||
          lawyer.specialty.toLowerCase().includes(normalizedSearch) ||
          lawyer.location.toLowerCase().includes(normalizedSearch);
        const matchesAvailability =
          availabilityFilter === 'all' ||
          (availabilityFilter === 'online' && lawyer.isOnline) ||
          (availabilityFilter === 'offline' && !lawyer.isOnline);
        const matchesSpecialty = specialtyFilter === 'all' || lawyer.specialty === specialtyFilter;

        return matchesSearch && matchesAvailability && matchesSpecialty;
      })
      .sort((left, right) => {
        if (sortMode === 'rating') return right.rating - left.rating;
        if (sortMode === 'followers') return right.followers - left.followers;
        return Number(right.isOnline) - Number(left.isOnline) || right.rating - left.rating || right.followers - left.followers;
      });
  }, [availabilityFilter, followedSearch, savedLawyers, sortMode, specialtyFilter]);

  const suggestedLawyers = useMemo(
    () => allLawyers.filter((lawyer) => !effectiveFollowedIds.includes(lawyer.id)).sort((left, right) => right.followers - left.followers),
    [allLawyers, effectiveFollowedIds]
  );

  const onlineFollowedCount = savedLawyers.filter((lawyer) => lawyer.isOnline).length;
  const totalFollowersAcrossSaved = savedLawyers.reduce((sum, lawyer) => sum + (lawyer.followers || 0), 0);
  const topSavedLawyer = savedLawyers.slice().sort((left, right) => right.rating - left.rating)[0] || null;
  const activeFilterCount = [
    followedSearch.trim().length > 0,
    availabilityFilter !== 'all',
    specialtyFilter !== 'all',
    sortMode !== 'priority',
  ].filter(Boolean).length;

  const resetFilters = () => {
    setFollowedSearch('');
    setAvailabilityFilter('all');
    setSpecialtyFilter('all');
    setSortMode('priority');
  };

  useEffect(() => {
    if (!effectiveFollowedIds.length) return;

    const interval = window.setInterval(() => {
      const randomFollowed = allLawyers.filter((lawyer) => effectiveFollowedIds.includes(lawyer.id) && lawyer.isOnline);
      const selected = randomFollowed[Math.floor(Math.random() * randomFollowed.length)];
      if (!selected) return;

      const nextAlert: AvailabilityAlert = {
        id: Date.now(),
        lawyerName: selected.name,
        lawyerId: selected.id,
        message: `${selected.name} متاح الآن للاستشارة السريعة.`,
        time: new Date().toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
      };

      setAlerts((current) => [nextAlert, ...current].slice(0, 4));
      setActiveToast(nextAlert);
      window.setTimeout(() => setActiveToast(null), 5000);
    }, 15000);

    return () => window.clearInterval(interval);
  }, [allLawyers, effectiveFollowedIds]);

  return (
    <div className="app-view fade-in mx-auto w-full min-w-0 max-w-full space-y-6 overflow-x-hidden pb-12 text-right">
      <AnimatePresence>
        {activeToast && (
          <motion.div
            initial={{ opacity: 0, y: -20, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: -12, x: '-50%' }}
            className="fixed left-1/2 top-24 z-[500] w-full max-w-md px-4"
          >
            <div className="flex items-center gap-4 rounded-[1.5rem] border border-white/10 bg-brand-navy/95 p-4 text-white shadow-2xl backdrop-blur-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gold/20 text-brand-gold">
                <i className="fa-solid fa-bell"></i>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-black text-brand-gold">تحديث من المحفوظات</p>
                <p className="truncate text-sm font-bold">{activeToast.message}</p>
              </div>
              <button
                onClick={() => navigate(`/profile/${activeToast.lawyerId}`)}
                className="rounded-xl bg-brand-gold px-4 py-2 text-xs font-black text-brand-dark transition hover:bg-yellow-500"
              >
                فتح
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <section className="min-w-0 overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 shadow-premium backdrop-blur">
        <div className="grid min-w-0 gap-0 xl:grid-cols-[minmax(0,1fr)_minmax(320px,400px)]">
          <div className="min-w-0 p-5 sm:p-6 md:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-gold/20 bg-brand-gold/10 px-3 py-1 text-[11px] font-black text-brand-gold">
              <i className="fa-solid fa-bookmark"></i>
              Saved Lawyers
            </div>
            <h2 className="mt-4 max-w-3xl text-3xl font-black leading-tight text-brand-dark md:text-4xl">المحامون المحفوظون</h2>
            <p className="mt-3 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              قائمة عملية للرجوع السريع إلى المحامين الذين تثق بهم، مع فلاتر للتوفر والتخصص وإجراءات مباشرة للتواصل أو فتح قضية.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <i className="fa-solid fa-user-check text-brand-gold"></i>
                  <p className="text-[11px] font-black text-slate-400">المحفوظون</p>
                </div>
                <p className="mt-2 text-2xl font-black text-brand-dark">{displayedTotalFollowed.toLocaleString('ar-IQ')}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <i className="fa-solid fa-signal text-emerald-500"></i>
                  <p className="text-[11px] font-black text-slate-400">متاحون الآن</p>
                </div>
                <p className="mt-2 text-2xl font-black text-brand-dark">{onlineFollowedCount.toLocaleString('ar-IQ')}</p>
              </div>
              <div className="rounded-[1.4rem] border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <i className="fa-solid fa-star text-amber-400"></i>
                  <p className="text-[11px] font-black text-slate-400">أفضل محفوظ</p>
                </div>
                <p className="mt-2 truncate text-sm font-black text-brand-dark">{topSavedLawyer ? `${topSavedLawyer.name} • ${topSavedLawyer.rating}` : 'لا يوجد'}</p>
              </div>
            </div>
          </div>

          <div className="border-t border-white/10 bg-[linear-gradient(135deg,#0B132B,#1A237E)] p-5 text-white sm:p-6 md:p-8 xl:border-r xl:border-t-0">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-lightgold">Saved Network</p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-black text-white/60">نتائج العرض</p>
                <p className="mt-2 text-3xl font-black">{followedLawyers.length.toLocaleString('ar-IQ')}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/10 p-4">
                <p className="text-[11px] font-black text-white/60">إجمالي المتابعين</p>
                <p className="mt-2 text-3xl font-black">{totalFollowersAcrossSaved.toLocaleString('ar-IQ')}</p>
              </div>
            </div>
            <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-white/10 p-4">
              <p className="text-[10px] font-black uppercase tracking-widest text-white/60">الإجراء الأسرع</p>
              <p className="mt-2 text-sm font-black">{onlineFollowedCount > 0 ? 'ابدأ بالمحامين المتاحين الآن' : 'راجع المقترحين أو افتح دليل المحامين'}</p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                <button type="button" onClick={() => setAvailabilityFilter('online')} className="rounded-xl bg-brand-gold px-3 py-2 text-[10px] font-black text-brand-dark transition hover:bg-brand-lightgold">المتاحون</button>
                <button type="button" onClick={() => navigate('/lawyers')} className="rounded-xl bg-white/10 px-3 py-2 text-[10px] font-black text-white transition hover:bg-white/20">دليل المحامين</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(300px,360px)]">
        <div className="min-w-0 space-y-6">
          <section className="min-w-0 rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-brand-dark">المحامون المحفوظون</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">
                {isLoading ? 'جاري تحميل قائمتك...' : `${followedLawyers.length.toLocaleString('ar-IQ')} نتيجة ضمن ${savedLawyers.length.toLocaleString('ar-IQ')} محفوظ`}
              </p>
            </div>
            <div className="relative w-full lg:w-96">
              <input
                type="text"
                value={followedSearch}
                onChange={(event) => setFollowedSearch(event.target.value)}
                placeholder="ابحث داخل المحفوظات"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
              />
              <i className="fa-solid fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px]">
            <div className="flex min-w-0 gap-2 overflow-x-auto pb-1 no-scrollbar">
            {([
              { id: 'all', label: 'الكل', count: savedLawyers.length },
              { id: 'online', label: 'متاح الآن', count: savedLawyers.filter((lawyer) => lawyer.isOnline).length },
              { id: 'offline', label: 'حسب الجدول', count: savedLawyers.filter((lawyer) => !lawyer.isOnline).length },
            ] as Array<{ id: AvailabilityFilter; label: string; count: number }>).map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setAvailabilityFilter(filter.id)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${availabilityFilter === filter.id ? 'bg-brand-navy text-white shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy hover:bg-white hover:text-brand-navy'}`}
              >
                {filter.label}
                <span className="mr-2 rounded-full bg-white/20 px-2 py-0.5">{filter.count.toLocaleString('ar-IQ')}</span>
              </button>
            ))}
            {specialties.map((specialty) => (
              <button
                key={specialty}
                type="button"
                onClick={() => setSpecialtyFilter(specialty)}
                className={`shrink-0 rounded-full px-4 py-2 text-xs font-black transition ${specialtyFilter === specialty ? 'bg-brand-gold text-brand-dark shadow-sm' : 'border border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-gold hover:bg-white hover:text-brand-dark'}`}
              >
                {specialty === 'all' ? 'كل التخصصات' : specialty}
              </button>
            ))}
            </div>
            <select
              value={sortMode}
              onChange={(event) => setSortMode(event.target.value as FollowedSortMode)}
              className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-black text-slate-700 outline-none transition focus:border-brand-navy"
            >
              <option value="priority">الأولوية الذكية</option>
              <option value="rating">الأعلى تقييماً</option>
              <option value="followers">الأكثر متابعة</option>
            </select>
          </div>
          {(activeFilterCount > 0) && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-slate-50 px-4 py-3">
              <span className="text-xs font-black text-slate-500">{activeFilterCount.toLocaleString('ar-IQ')} فلتر نشط</span>
              <button onClick={resetFilters} className="text-xs font-black text-brand-navy transition hover:text-brand-dark">مسح الفلاتر</button>
            </div>
          )}
          {loadWarning && (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
              <span className="text-xs font-black text-amber-700">{loadWarning}</span>
              <button type="button" onClick={retryLoad} className="text-xs font-black text-brand-navy transition hover:text-brand-dark">إعادة المحاولة</button>
            </div>
          )}
          </section>

          {loadError ? (
            <EmptyState
              icon="circle-exclamation"
              title="تعذر تحميل المحفوظات"
              description={loadError}
              action={
                <div className="flex flex-wrap justify-center gap-3">
                  <ActionButton onClick={retryLoad} variant="primary">إعادة المحاولة</ActionButton>
                  <ActionButton onClick={() => navigate('/lawyers')} variant="secondary">دليل المحامين</ActionButton>
                </div>
              }
            />
          ) : isLoading ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {[0, 1, 2, 3].map((item) => (
                <div key={item} className="h-80 animate-pulse rounded-[2rem] border border-slate-200 bg-white shadow-sm" />
              ))}
            </div>
          ) : followedLawyers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {followedLawyers.map((lawyer) => (
                <motion.article
                  key={lawyer.id}
                  layout
                  className="group min-w-0 overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm transition hover:border-brand-navy/30 hover:shadow-lg sm:p-6"
                >
                  <div className="flex min-w-0 items-start justify-between gap-4">
                    <div className="min-w-0 space-y-3 text-right">
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {lawyer.verified && (
                          <StatusBadge tone="info" className="px-2.5 py-1 text-[11px]">
                            <i className="fa-solid fa-circle-check"></i>
                            موثق
                          </StatusBadge>
                        )}
                        <StatusBadge className="px-2.5 py-1 text-[11px]">
                          {lawyer.specialty}
                        </StatusBadge>
                      </div>
                      <div>
                        <h3 className="truncate text-lg font-black text-brand-dark">{lawyer.name}</h3>
                        <p className="mt-1 line-clamp-2 text-sm font-bold text-slate-500">{lawyer.tagline}</p>
                      </div>
                    </div>
                    <div className="relative shrink-0">
                      <img src={lawyer.avatar} alt={lawyer.name} className="h-16 w-16 rounded-2xl object-cover shadow-sm ring-4 ring-slate-50 transition group-hover:scale-105" />
                      <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${lawyer.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">التقييم</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.rating} • {lawyer.reviewCount}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">الخبرة</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.experienceYears} سنوات</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3 text-right">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">المتابعون</p>
                      <p className="mt-1 text-sm font-black text-brand-dark">{lawyer.followers.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className={`mt-5 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between ${lawyer.isOnline ? 'border-emerald-100 bg-emerald-50/60' : 'border-slate-200 bg-slate-50'}`}>
                    <div className="text-right">
                      <p className={`text-xs font-black ${lawyer.isOnline ? 'text-emerald-700' : 'text-slate-600'}`}>{lawyer.isOnline ? 'متاح الآن' : lawyer.responseTime}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">يثق به {lawyer.followers.toLocaleString()} متابع</p>
                    </div>
                    <FollowButton isFollowing={true} isLoading={isPending(lawyer.id)} onToggle={() => unfollow(lawyer.id)} className="w-full sm:w-auto" />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <ActionButton
                      onClick={() => navigate(`/profile/${lawyer.id}`)}
                      variant="secondary"
                      className="w-full"
                    >
                      عرض الملف
                    </ActionButton>
                    <ActionButton
                      onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)}
                      variant="ghost"
                      className="w-full"
                    >
                      تواصل
                    </ActionButton>
                    <ActionButton
                      onClick={() => navigate('/cases', { state: { openNewCase: true, preselectedLawyerId: lawyer.id } })}
                      variant="primary"
                      className="w-full"
                    >
                      افتح قضية
                    </ActionButton>
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="user-plus"
              title={savedLawyers.length > 0 ? 'لا توجد نتائج مطابقة' : 'لا توجد محامون محفوظون بعد'}
              description={savedLawyers.length > 0 ? 'غيّر البحث أو الفلاتر لعرض محامين محفوظين أكثر.' : 'احفظ المحامين المناسبين لاحتياجك حتى تتمكن من العودة إليهم بسرعة والتواصل معهم من دون إعادة البحث.'}
              action={
                savedLawyers.length > 0 ? (
                  <ActionButton onClick={resetFilters} variant="primary">مسح الفلاتر</ActionButton>
                ) : (
                  <ActionButton onClick={() => navigate('/lawyers')} variant="primary">
                    ابحث عن محامٍ
                  </ActionButton>
                )
              }
            />
          )}
        </div>

        <aside className="min-w-0 space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-brand-dark">مقترحون لك</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">مرتبون حسب الثقة والتخصص وعدد المتابعين.</p>
            <div className="mt-4 space-y-4">
              {suggestedLawyers.slice(0, 3).map((lawyer) => (
                <div key={lawyer.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1 text-right">
                      <p className="truncate text-sm font-black text-brand-dark">{lawyer.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{lawyer.specialty} • {lawyer.location}</p>
                      <p className="mt-2 text-[11px] font-black text-brand-gold">{lawyer.followers.toLocaleString()} متابع • {lawyer.rating} نجوم</p>
                    </div>
                    <img src={lawyer.avatar} alt={lawyer.name} className="h-12 w-12 rounded-2xl object-cover" />
                  </div>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
                    <ActionButton onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)} variant="secondary" size="sm" className="flex-1">
                      تواصل
                    </ActionButton>
                    <FollowButton isFollowing={isFollowed(lawyer.id)} isLoading={isPending(lawyer.id)} onToggle={() => follow(lawyer.id)} className="flex-1" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          {alerts.length > 0 && (
            <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-black text-brand-dark">آخر التحديثات</h3>
                <button onClick={() => setAlerts([])} className="text-[11px] font-black text-slate-400 transition hover:text-red-500">
                  مسح
                </button>
              </div>
              <div className="mt-4 space-y-3">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="text-sm font-black text-brand-dark">{alert.message}</p>
                    <p className="mt-1 text-[11px] font-bold text-slate-400">{alert.time}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </aside>
      </section>
    </div>
  );
}
