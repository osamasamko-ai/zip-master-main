import React, { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import FollowButton from '../components/FollowButton';
import ActionButton from '../components/ui/ActionButton';
import EmptyState from '../components/ui/EmptyState';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import { useFollowedLawyers } from '../hooks/useFollowedLawyers';
import apiClient from '../api/client';

interface AvailabilityAlert {
  id: number;
  lawyerName: string;
  lawyerId: string;
  message: string;
  time: string;
}

export default function Following() {
  const navigate = useNavigate();
  const { followedIds, follow, unfollow, isFollowed, totalFollowed } = useFollowedLawyers();
  const [followedSearch, setFollowedSearch] = useState('');
  const [alerts, setAlerts] = useState<AvailabilityAlert[]>([]);
  const [activeToast, setActiveToast] = useState<AvailabilityAlert | null>(null);
  const [allLawyers, setAllLawyers] = useState<any[]>([]);
  const [followedData, setFollowedData] = useState<any[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [lawyersResponse, followingResponse] = await Promise.all([
          apiClient.getLawyers(),
          apiClient.getFollowing(),
        ]);
        setAllLawyers(lawyersResponse.data || []);
        setFollowedData(followingResponse.data || []);
      } catch (error) {
        console.error('Failed to load following page data', error);
      }
    };

    load();
  }, [followedIds]);

  const followedLawyers = useMemo(
    () =>
      followedData.filter((lawyer) => lawyer.name.toLowerCase().includes(followedSearch.trim().toLowerCase()))
        .sort((left, right) => Number(right.isOnline) - Number(left.isOnline) || right.rating - left.rating),
    [followedData, followedSearch]
  );

  const suggestedLawyers = useMemo(
    () => allLawyers.filter((lawyer) => !followedIds.includes(lawyer.id)).sort((left, right) => right.followers - left.followers),
    [allLawyers, followedIds]
  );

  useEffect(() => {
    if (!followedIds.length) return;

    const interval = window.setInterval(() => {
      const randomFollowed = followedData.filter((lawyer) => followedIds.includes(lawyer.id) && lawyer.isOnline);
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
  }, [followedData, followedIds]);

  return (
    <div className="app-view fade-in space-y-8 pb-12 text-right">
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
                <p className="text-xs font-black text-brand-gold">تحديث من قائمة المتابعة</p>
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

      <section className="relative overflow-hidden rounded-[2.5rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.03] p-8 shadow-premium">
        <div className="absolute -left-20 -top-20 h-56 w-56 rounded-full bg-brand-gold/10 blur-3xl"></div>
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-brand-gold">شبكة الثقة</p>
            <h2 className="mt-3 text-3xl font-black text-brand-dark">قائمة المتابعة</h2>
            <p className="mt-2 max-w-2xl text-sm font-bold leading-7 text-slate-500">
              تابع المحامين الذين تثق بهم، واحصل على وصول أسرع إليهم في البحث والنتائج والتنبيهات.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:min-w-[320px]">
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المتابَعون</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">{totalFollowed}</p>
              <p className="mt-1 text-xs font-bold text-slate-500">قائمة مفضلة سريعة الوصول</p>
            </div>
            <div className="rounded-3xl border border-white bg-white/90 p-4 shadow-sm">
              <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">الدليل الاجتماعي</p>
              <p className="mt-2 text-3xl font-black text-brand-dark">
                {followedLawyers.reduce((sum, lawyer) => sum + lawyer.followers, 0).toLocaleString()}
              </p>
              <p className="mt-1 text-xs font-bold text-slate-500">إجمالي متابعي المحامين المتابَعين</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <NoticePanel
            title="الخطوة التالية"
            description="إذا كنت تبحث عن قرار سريع، ابدأ بالمحامي المتصل الآن أو صاحب أعلى توافق مع تخصصك المطلوب. المتابَعون يُرتبون أولًا افتراضيًا."
          />
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h3 className="text-xl font-black text-brand-dark">قائمة المتابعة</h3>
              <p className="mt-1 text-xs font-bold text-slate-400">المحامون المتابَعون يظهرون أولًا في بقية رحلات البحث داخل المنصة.</p>
            </div>
            <div className="relative w-full lg:w-96">
              <input
                type="text"
                value={followedSearch}
                onChange={(event) => setFollowedSearch(event.target.value)}
                placeholder="ابحث داخل قائمة المتابعة"
                className="w-full rounded-2xl border border-slate-200 bg-white py-3 pl-4 pr-11 text-sm font-bold text-slate-700 outline-none transition focus:border-brand-navy"
              />
              <i className="fa-solid fa-magnifying-glass absolute right-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
            </div>
          </div>

          {followedLawyers.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2">
              {followedLawyers.map((lawyer) => (
                <motion.article
                  key={lawyer.id}
                  layout
                  className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-3 text-right">
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
                        <h3 className="text-lg font-black text-brand-dark">{lawyer.name}</h3>
                        <p className="mt-1 text-sm font-bold text-slate-500">{lawyer.tagline}</p>
                      </div>
                    </div>
                    <div className="relative">
                      <img src={lawyer.avatar} alt={lawyer.name} className="h-16 w-16 rounded-2xl object-cover shadow-sm" />
                      <span className={`absolute bottom-0 right-0 h-3.5 w-3.5 rounded-full border-2 border-white ${lawyer.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                    </div>
                  </div>

                  <div className="mt-5 grid grid-cols-3 gap-3">
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

                  <div className="mt-5 flex items-center justify-between rounded-2xl border border-emerald-100 bg-emerald-50/60 px-4 py-3">
                    <div className="text-right">
                      <p className="text-xs font-black text-emerald-700">{lawyer.responseTime}</p>
                      <p className="mt-1 text-[11px] font-bold text-slate-500">يثق به {lawyer.followers.toLocaleString()} متابع</p>
                    </div>
                    <FollowButton isFollowing={true} onToggle={() => unfollow(lawyer.id)} />
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <ActionButton
                      onClick={() => navigate(`/profile/${lawyer.id}`)}
                      variant="secondary"
                      className="w-full"
                    >
                      عرض الملف
                    </ActionButton>
                    <ActionButton
                      onClick={() => navigate('/user', { state: { activeTab: 'schedule' } })}
                      variant="primary"
                      className="w-full"
                    >
                      احجز الآن
                    </ActionButton>
                  </div>
                </motion.article>
              ))}
            </div>
          ) : (
            <EmptyState
              icon="user-plus"
              title="لم تبدأ قائمة المتابعة بعد"
              description="تابع المحامين الموثقين الذين يناسبون احتياجك لتسريع العودة إليهم وإبرازهم في نتائج البحث والمقارنة."
            />
          )}
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-base font-black text-brand-dark">مقترحون لك</h3>
            <p className="mt-1 text-xs font-bold text-slate-500">مرتبون حسب الثقة والتخصص وعدد المتابعين.</p>
            <div className="mt-4 space-y-4">
              {suggestedLawyers.slice(0, 3).map((lawyer) => (
                <div key={lawyer.id} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-dark">{lawyer.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{lawyer.specialty} • {lawyer.location}</p>
                      <p className="mt-2 text-[11px] font-black text-brand-gold">{lawyer.followers.toLocaleString()} متابع • {lawyer.rating} نجوم</p>
                    </div>
                    <img src={lawyer.avatar} alt={lawyer.name} className="h-12 w-12 rounded-2xl object-cover" />
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <ActionButton
                      onClick={() => navigate(`/profile/${lawyer.id}`)}
                      variant="secondary"
                      size="sm"
                      className="flex-1"
                    >
                      الملف
                    </ActionButton>
                    <FollowButton isFollowing={isFollowed(lawyer.id)} onToggle={() => follow(lawyer.id)} className="flex-1" />
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
