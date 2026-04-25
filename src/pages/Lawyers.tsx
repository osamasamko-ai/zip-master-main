import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import FollowButton from '../components/FollowButton';
import StatusBadge from '../components/ui/StatusBadge';
import apiClient from '../api/client';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';

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

  useEffect(() => {
    const load = async () => {
      try {
        const response = await apiClient.getLawyers();
        setLawyers(response.data || []);
        setSelectedLawyerId((response.data || [])[0]?.id || '');
      } catch (error) {
        console.error('Failed to load lawyers', error);
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

  const handleOpenCase = (lawyer: LawyerItem) => {
    navigate('/cases', { state: { openNewCase: true, preselectedLawyerId: lawyer.id } });
  };

  const handleContact = (lawyer: LawyerItem) => {
    navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`);
  };

  return (
    <div className="app-view fade-in space-y-8 pb-12 text-right">
      <section className="rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-8 shadow-premium">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">Find A Lawyer</p>
            <h1 className="mt-3 text-3xl font-black text-brand-dark">ابحث عن المحامي المناسب بسرعة</h1>
            <p className="mt-2 max-w-3xl text-sm font-bold leading-7 text-slate-500">
              ابحث حسب نوع القضية أو التخصص أو المدينة، ثم تواصل أو افتح ملفاً جديداً مباشرة من النتيجة دون المرور بخطوات إضافية.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">النتائج</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">{filteredLawyers.length.toLocaleString('ar-IQ')}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">مطابقة للبحث الحالي</p>
            </div>
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المتاحون الآن</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">
                {filteredLawyers.filter((lawyer) => lawyer.isOnline).length.toLocaleString('ar-IQ')}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">جاهزون للتواصل</p>
            </div>
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المحفوظون</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">{followedIds.length.toLocaleString('ar-IQ')}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">عودة أسرع لاحقاً</p>
            </div>
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

            <div className="mt-4 flex flex-wrap justify-end gap-3">
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
                onClick={() => {
                  setQuery('');
                  setSpecialty('الكل');
                  setVerifiedOnly(false);
                  setOnlineOnly(false);
                  setSortMode('best');
                }}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-black text-slate-500 transition hover:border-brand-navy hover:text-brand-navy"
              >
                مسح الفلاتر
              </button>
            </div>
          </section>

          {filteredLawyers.length > 0 ? (
            <div className="grid gap-4">
              {filteredLawyers.map((lawyer) => (
                <article
                  key={lawyer.id}
                  className={`rounded-[2rem] border bg-white p-5 text-right shadow-sm transition ${selectedLawyer?.id === lawyer.id ? 'border-brand-navy shadow-lg' : 'border-slate-200 hover:border-brand-navy/30 hover:shadow-md'}`}
                >
                  <div className="flex flex-col gap-4 lg:flex-row-reverse lg:items-start lg:justify-between">
                    <div className="flex items-start gap-4">
                      <img src={lawyer.avatar} alt={lawyer.name} className="h-20 w-20 rounded-[1.75rem] object-cover shadow-sm" />
                      <div className="space-y-3">
                        <div className="flex flex-wrap items-center justify-end gap-2">
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
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black text-slate-600 transition hover:border-brand-navy hover:bg-white hover:text-brand-navy"
                    >
                      عرض الملخص
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
                    <ActionButton onClick={() => handleContact(lawyer)} variant="primary" className="w-full">
                      <i className="fa-regular fa-paper-plane"></i>
                      تواصل الآن
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
                    <ActionButton onClick={() => navigate(`/profile/${lawyer.id}`)} variant="ghost" className="w-full">
                      عرض الملف
                    </ActionButton>
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
                    setQuery('');
                    setSpecialty('الكل');
                    setVerifiedOnly(false);
                    setOnlineOnly(false);
                    setSortMode('best');
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
                  <ActionButton onClick={() => handleContact(selectedLawyer)} variant="primary" className="w-full">
                    تواصل الآن
                  </ActionButton>
                  <ActionButton onClick={() => handleOpenCase(selectedLawyer)} variant="secondary" className="w-full">
                    افتح قضية مع هذا المحامي
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
    </div>
  );
}
