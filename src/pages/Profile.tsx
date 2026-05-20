import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import FollowButton from '../components/FollowButton';
import ActionButton from '../components/ui/ActionButton';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';
import apiClient from '../api/client';

type PublicTab = 'overview' | 'posts' | 'reviews' | 'activity';

type ProfileStory = {
  id: string;
  text: string;
  mediaUrl?: string | null;
  mediaType?: 'image' | 'video' | null;
  seenByMe: boolean;
  viewedAt?: string | null;
  createdAt: string;
  expiresAt: string;
};

function formatPostDate(value: string) {
  return new Intl.DateTimeFormat('ar-IQ', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function SchedulingCalendar() {
  const [selectedDate, setSelectedDate] = useState(0);
  const days = [
    { day: 'السبت', date: '20 نيسان' },
    { day: 'الأحد', date: '21 نيسان' },
    { day: 'الاثنين', date: '22 نيسان' },
    { day: 'الثلاثاء', date: '23 نيسان' },
    { day: 'الأربعاء', date: '24 نيسان' },
  ];
  const slots = ['09:00 ص', '10:30 ص', '12:00 م', '02:00 م', '04:30 م', '06:00 م'];

  return (
    <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="text-right">
          <h3 className="text-xl font-black text-brand-dark">مواعيد متاحة للحجز</h3>
          <p className="mt-1 text-xs font-bold text-slate-500">اختر الوقت المناسب لبدء الاستشارة بسرعة.</p>
        </div>
        <div className="rounded-full bg-slate-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-brand-navy">
          توقيت بغداد
        </div>
      </div>

      <div className="mt-5 flex gap-3 overflow-x-auto pb-2">
        {days.map((day, index) => (
          <button
            key={day.date}
            onClick={() => setSelectedDate(index)}
            className={`min-w-[98px] rounded-3xl border px-4 py-4 text-center transition ${selectedDate === index
              ? 'border-brand-navy bg-brand-navy text-white shadow-lg shadow-brand-navy/15'
              : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-brand-navy/30'
              }`}
          >
            <p className="text-[10px] font-black uppercase tracking-widest opacity-75">{day.day}</p>
            <p className="mt-1 text-sm font-black">{day.date}</p>
          </button>
        ))}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {slots.map((slot) => (
          <button
            key={slot}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-black text-slate-700 transition hover:border-brand-navy hover:bg-white hover:text-brand-navy"
          >
            {slot}
          </button>
        ))}
      </div>
    </div>
  );
}

function PublicStat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-black text-brand-dark">{value}</p>
      <p className="mt-1 text-xs font-bold text-slate-500">{note}</p>
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState<PublicTab>('overview');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { isFollowed, isPending, toggleFollow } = useFollowedLawyers();
  const [lawyer, setLawyer] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [lawyerPosts, setLawyerPosts] = useState<any[]>([]);
  const [lawyerStories, setLawyerStories] = useState<ProfileStory[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [storyProgress, setStoryProgress] = useState(0);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [relatedLawyers, setRelatedLawyers] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');
  const activeStory = activeStoryIndex === null ? null : lawyerStories[activeStoryIndex] || null;

  const markStorySeen = React.useCallback((selectedStory: ProfileStory) => {
    if (selectedStory.seenByMe) return;

    setLawyerStories((current) =>
      current.map((item) =>
        item.id === selectedStory.id
          ? { ...item, seenByMe: true, viewedAt: item.viewedAt || new Date().toISOString() }
          : item
      )
    );
    apiClient.markFeedStoryViewed(selectedStory.id)
      .then((response) => {
        setLawyerStories((current) => current.map((item) => (item.id === selectedStory.id ? { ...item, ...response.data } : item)));
      })
      .catch(() => undefined);
  }, []);

  const openStory = React.useCallback((story?: ProfileStory) => {
    const selectedStory = story || lawyerStories.find((item) => !item.seenByMe) || lawyerStories[0];
    if (!selectedStory) return;

    const selectedIndex = Math.max(0, lawyerStories.findIndex((item) => item.id === selectedStory.id));
    setStoryProgress(0);
    setActiveStoryIndex(selectedIndex);
    markStorySeen(selectedStory);
  }, [lawyerStories, markStorySeen]);

  const goToStory = React.useCallback((direction: 1 | -1) => {
    if (activeStoryIndex === null) return;
    const nextIndex = activeStoryIndex + direction;

    if (nextIndex < 0) return;
    if (nextIndex >= lawyerStories.length) {
      setActiveStoryIndex(null);
      setStoryProgress(0);
      return;
    }

    setStoryProgress(0);
    setActiveStoryIndex(nextIndex);
    markStorySeen(lawyerStories[nextIndex]);
  }, [activeStoryIndex, lawyerStories, markStorySeen]);

  React.useEffect(() => {
    const load = async () => {
      if (!params.id) return;
      const routeState = location.state as { lawyer?: any } | null;

      if (routeState?.lawyer) {
        setLawyer((current) => current || routeState.lawyer);
      }

      try {
        const [profileResponse, lawyersResponse] = await Promise.all([
          apiClient.getLawyerProfile(params.id),
          apiClient.getLawyers(),
        ]);
        setLoadError('');
        const profileData = (profileResponse as any).data?.data || (profileResponse as any).data || profileResponse;
        if (!profileData?.lawyer) {
          throw new Error('Invalid lawyer profile response');
        }
        setLawyer(profileData.lawyer);
        setReviews(profileData.reviews || []);
        setLawyerPosts(profileData.posts || []);
        setLawyerStories(profileData.stories || []);
        setActivityItems(profileData.activity || []);
        setRelatedLawyers((lawyersResponse.data || []).filter((item: any) => item.id !== params.id && item.specialty === profileData.lawyer.specialty).slice(0, 2));
      } catch (error) {
        console.error('Failed to load lawyer profile', error);
        setLoadError('تعذر فتح ملف المحامي حالياً. حاول مرة أخرى.');
      }
    };
    load();
  }, [location.state, params.id]);

  React.useEffect(() => {
    const handleFollowStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lawyerId: string; delta: number; followerCount?: number }>;
      const { lawyerId, delta, followerCount } = customEvent.detail;

      setLawyer((current: any) =>
        current && current.id === lawyerId
          ? {
            ...current,
            followers: typeof followerCount === 'number' ? followerCount : Math.max(0, (current.followers ?? 0) + delta),
          }
          : current,
      );

      setRelatedLawyers((current: any[]) =>
        current.map((item) =>
          item.id === lawyerId
            ? {
              ...item,
              followers: typeof followerCount === 'number' ? followerCount : Math.max(0, (item.followers ?? 0) + delta),
            }
            : item,
        ),
      );
    };

    window.addEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
  }, []);

  React.useEffect(() => {
    setStoryProgress(0);
  }, [activeStoryIndex]);

  React.useEffect(() => {
    if (!activeStory) return undefined;

    const duration = activeStory.mediaType === 'video' ? 12000 : 6000;
    const tickMs = 80;
    const increment = (tickMs / duration) * 100;
    const timer = window.setInterval(() => {
      setStoryProgress((current) => {
        const next = current + increment;
        if (next >= 100) {
          window.clearInterval(timer);
          window.setTimeout(() => goToStory(1), 0);
          return 100;
        }
        return next;
      });
    }, tickMs);

    return () => window.clearInterval(timer);
  }, [activeStory, goToStory]);

  if (!lawyer && loadError) {
    return (
      <div className="app-view w-full min-w-0 text-right">
        <div className="rounded-[2rem] border border-red-200 bg-red-50 p-6 text-red-700">
          <p className="text-base font-black">{loadError}</p>
          <button
            type="button"
            onClick={() => navigate('/lawyers')}
            className="mt-4 rounded-2xl bg-white px-4 py-2 text-sm font-black text-brand-navy shadow-sm"
          >
            العودة إلى قائمة المحامين
          </button>
        </div>
      </div>
    );
  }

  if (!lawyer) {
    return <div className="app-view w-full min-w-0 text-right">جاري تحميل الملف...</div>;
  }

  const isFollowing = isFollowed(lawyer.id);
  const hasStories = lawyerStories.length > 0;
  const hasNewStory = lawyerStories.some((story) => !story.seenByMe);
  const socialProofText = `${lawyer.followers.toLocaleString()} متابع • ${lawyer.reviewCount} مراجعة موثقة • ${lawyer.casesHandled}`;

  const credentialBadges = [
    `رقم النقابة: ${lawyer.license}`,
    `المرفقات: ${lawyer.attachments.length} / 3`,
    `درجة الملف: ${lawyer.profileScore ?? 0}%`,
    `الانضمام: ${lawyer.submittedAt ?? 'غير محدد'}`,
  ];

  return (
    <div className="app-view mx-auto w-full min-w-0 max-w-[1400px] space-y-5 overflow-x-hidden pb-24 text-right">
      <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className={`relative h-56 bg-gradient-to-br ${lawyer.accent} sm:h-72`}>
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.24),transparent_32%),linear-gradient(180deg,transparent,rgba(0,0,0,0.22))]" />
          <button
            type="button"
            onClick={() => navigate('/feed')}
            className="absolute left-4 top-4 rounded-md bg-white/90 px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-white"
          >
            <i className="fa-solid fa-newspaper ml-2 text-[#1877f2]"></i>
            منشوراته
          </button>
        </div>

        <div className="px-5 pb-5">
          <div className="-mt-16 flex flex-col gap-4 border-b border-slate-200 pb-5 lg:flex-row-reverse lg:items-end lg:justify-between">
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row-reverse sm:text-right">
              <div className="relative">
                <button
                  type="button"
                  onClick={() => openStory()}
                  disabled={!hasStories}
                  className={`relative rounded-full p-1 transition ${hasStories ? 'cursor-pointer hover:scale-[1.02]' : 'cursor-default'} ${hasStories ? (hasNewStory ? 'bg-[#1877f2]' : 'bg-slate-300') : 'bg-transparent'}`}
                  title={hasStories ? 'عرض قصة المحامي' : undefined}
                >
                  <img src={lawyer.avatar} alt={lawyer.name} className="h-32 w-32 rounded-full border-4 border-white bg-white object-cover shadow-md sm:h-40 sm:w-40" />
                </button>
                <span className={`absolute bottom-3 right-3 h-5 w-5 rounded-full border-4 border-white ${lawyer.isOnline ? 'bg-emerald-500' : 'bg-slate-300'}`}></span>
                {hasStories && (
                  <button
                    type="button"
                    onClick={() => openStory()}
                    className={`absolute bottom-2 left-2 flex h-9 w-9 items-center justify-center rounded-full border-4 border-white text-white shadow-md ${hasNewStory ? 'bg-[#1877f2]' : 'bg-slate-500'}`}
                    title="عرض القصة"
                  >
                    <i className="fa-solid fa-play text-[10px]"></i>
                  </button>
                )}
              </div>
              <div className="pt-2">
                <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
                  {lawyer.verified && (
                    <StatusBadge tone="info">
                      <i className="fa-solid fa-circle-check"></i>
                      محامٍ موثق
                    </StatusBadge>
                  )}
                  <StatusBadge tone="neutral">{lawyer.specialty}</StatusBadge>
                </div>
                <h1 className="mt-3 text-3xl font-black leading-tight text-slate-950 sm:text-4xl">{lawyer.name}</h1>
                <p className="mt-2 text-sm font-bold text-slate-600">{lawyer.tagline}</p>
                <p className="mt-2 text-sm font-black text-slate-500">{socialProofText}</p>
                {hasStories && (
                  <button
                    type="button"
                    onClick={() => openStory()}
                    className={`mt-3 inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-black transition ${hasNewStory ? 'bg-[#e7f3ff] text-[#1877f2] hover:bg-[#dbeafe]' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${hasNewStory ? 'bg-[#1877f2]' : 'bg-slate-400'}`}></span>
                    {hasNewStory ? 'قصة جديدة' : 'عرض القصة'}
                  </button>
                )}
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-2 lg:justify-end">
              <ActionButton
                onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)}
                variant="primary"
                size="sm"
              >
                <i className="fa-solid fa-comment"></i>
                تواصل
              </ActionButton>
              <FollowButton isFollowing={isFollowing} isLoading={isPending(lawyer.id)} onToggle={() => toggleFollow(lawyer.id)} className="px-4 py-2 text-xs" />
              <button
                onClick={() => setNotificationsEnabled((current) => !current)}
                className={`flex h-10 w-10 items-center justify-center rounded-md border transition ${notificationsEnabled ? 'border-[#1877f2]/20 bg-[#e7f3ff] text-[#1877f2]' : 'border-slate-200 bg-slate-100 text-slate-400'}`}
                title="تنبيهات النشاط"
              >
                <i className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}></i>
              </button>
            </div>
          </div>

          <div className="grid gap-3 py-5 sm:grid-cols-4">
            <PublicStat label="التقييم" value={lawyer.rating.toFixed(1)} note={`${lawyer.reviewCount} مراجعة`} />
            <PublicStat label="المتابعون" value={lawyer.followers.toLocaleString()} note="متابع" />
            <PublicStat label="الخبرة" value={`${lawyer.experienceYears}`} note="سنوات ممارسة" />
            <PublicStat label="القضايا" value={lawyer.casesHandled} note="منجزة" />
          </div>
        </div>
      </section>

      <div className="sticky top-16 z-30 w-full min-w-0 rounded-lg border border-slate-200 bg-white/95 px-4 py-3 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap justify-end gap-2">
            {[
              { id: 'overview' as const, label: 'حول' },
              { id: 'posts' as const, label: 'المنشورات' },
              { id: 'reviews' as const, label: 'المراجعات' },
              { id: 'activity' as const, label: 'النشاط' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-md px-4 py-2 text-sm font-black transition ${activeTab === tab.id
                  ? 'bg-[#e7f3ff] text-[#1877f2]'
                  : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            <ActionButton
              onClick={() => navigate('/cases', { state: { openNewCase: true, preselectedLawyerId: lawyer.id } })}
              variant="secondary"
              size="sm"
            >
              افتح قضية
            </ActionButton>
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-6">
            <NoticePanel
              title="الخطوة التالية"
              description={`أفضل خطوة الآن هي ${lawyer.isOnline ? 'بدء رسالة مباشرة' : 'فتح قضية جديدة مع هذا المحامي'} إذا كان تخصص ${lawyer.specialty} يطابق حاجتك الحالية.`}
              action={
                <ActionButton onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)} variant="primary" size="sm">
                  ابدأ الآن
                </ActionButton>
              }
            />
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-brand-dark">نبذة وتعريف</h3>
              <p className="mt-4 text-sm font-bold leading-8 text-slate-600">{lawyer.bio}</p>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-brand-dark">التخصصات والتميز</h3>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {lawyer.highlights.map((item) => (
                  <span key={item} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-black text-slate-700">
                    <i className="fa-solid fa-star-of-life ml-1 text-brand-gold"></i> {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-xl font-black text-brand-dark">اعتماد الملف المهني</h3>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">رقم النقابة</p>
                  <p className="mt-2 text-sm font-black text-brand-dark">{lawyer.license}</p>
                </div>
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">حالة التحقق</p>
                  <p className={`mt-2 text-sm font-black ${lawyer.status === 'approved' ? 'text-emerald-600' : lawyer.status === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>
                    {lawyer.status === 'approved' ? 'معتمد' : lawyer.status === 'pending' ? 'قيد الانتظار' : 'مرفوض'}
                  </p>
                </div>
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">المرفقات المهنية</p>
                  <p className="mt-2 text-sm font-black text-brand-dark">{lawyer.attachments.length} مرفقات</p>
                </div>
                <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4">
                  <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">درجة الملف</p>
                  <p className="mt-2 text-sm font-black text-brand-dark">{lawyer.profileScore ?? 0}%</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-2">
                {lawyer.attachments.map((attachment) => (
                  <span key={attachment} className="rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600">
                    {attachment}
                  </span>
                ))}
              </div>
            </div>

            <SchedulingCalendar />
          </div>

          <aside className="min-w-0 space-y-6">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-brand-dark">إشارات الثقة</h3>
              <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>{lawyer.verified ? 'موثق' : 'بانتظار التوثيق'}</span>
                  <span className="text-brand-dark">التحقق</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>{lawyer.reviewCount} مراجعة</span>
                  <span className="text-brand-dark">المراجعات</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span>{lawyer.consultationFee}</span>
                  <span className="text-brand-dark">سعر الاستشارة</span>
                </div>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-brand-dark">محامون مشابهون</h3>
              <div className="mt-4 space-y-3">
                {relatedLawyers.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => navigate(`/profile/${item.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-3 transition hover:border-brand-navy/20 hover:bg-white"
                  >
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-dark">{item.name}</p>
                      <p className="mt-1 text-xs font-bold text-slate-500">{item.specialty} • {item.rating}</p>
                    </div>
                    <img src={item.avatar} alt={item.name} className="h-12 w-12 rounded-2xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'posts' && (
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-5">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-right">
                  <h3 className="text-xl font-black text-brand-dark">منشورات {lawyer.name}</h3>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    آخر المنشورات القانونية التي شاركها هذا المحامي في تواصل.
                  </p>
                </div>
                <ActionButton onClick={() => navigate('/feed')} variant="secondary" size="sm">
                  عرض تواصل
                </ActionButton>
              </div>
            </div>

            {lawyerPosts.length === 0 ? (
              <div className="rounded-[2rem] border border-dashed border-slate-200 bg-white p-8 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <i className="fa-solid fa-newspaper text-xl"></i>
                </div>
                <h3 className="mt-4 text-base font-black text-brand-dark">لا توجد منشورات بعد</h3>
                <p className="mt-2 text-sm font-bold text-slate-500">عند نشر المحامي في تواصل ستظهر منشوراته هنا.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {lawyerPosts.map((post) => (
                  <article key={post.id} className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-sm">
                    <div className="p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex flex-wrap items-center justify-end gap-2">
                            {post.pinned && (
                              <StatusBadge tone="warning" className="px-2.5 py-1 text-[11px]">
                                <i className="fa-solid fa-thumbtack"></i>
                                مثبت
                              </StatusBadge>
                            )}
                            {post.featured && (
                              <StatusBadge tone="info" className="px-2.5 py-1 text-[11px]">
                                <i className="fa-solid fa-star"></i>
                                مميز
                              </StatusBadge>
                            )}
                            <span className="rounded-full bg-[#e7f3ff] px-3 py-1 text-[11px] font-black text-[#1877f2]">
                              #{post.category}
                            </span>
                          </div>
                          <p className="mt-2 text-xs font-bold text-slate-400">{formatPostDate(post.createdAt)}</p>
                        </div>
                        <img src={lawyer.avatar} alt={lawyer.name} className="h-12 w-12 shrink-0 rounded-full object-cover ring-1 ring-slate-200" />
                      </div>

                      {post.content && (
                        <p className="mt-4 whitespace-pre-wrap text-sm font-bold leading-8 text-slate-700">{post.content}</p>
                      )}
                    </div>

                    {post.mediaUrl && (
                      <div className="border-y border-slate-100 bg-slate-100">
                        {post.mediaType === 'video' ? (
                          <div className="relative aspect-square max-h-[620px] w-full bg-black sm:aspect-[4/3]">
                            <video src={post.mediaUrl} controls className="h-full w-full object-contain" />
                          </div>
                        ) : (
                          <div className="flex aspect-square max-h-[620px] w-full items-center justify-center bg-slate-100 sm:aspect-[4/3]">
                            <img src={post.mediaUrl} alt="" className="h-full w-full object-contain" />
                          </div>
                        )}
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 text-xs font-black text-slate-500">
                      <span>{post.likesCount.toLocaleString('ar-IQ')} إعجاب · {post.commentsCount.toLocaleString('ar-IQ')} تعليق · {post.shareCount.toLocaleString('ar-IQ')} مشاركة</span>
                      <button
                        type="button"
                        onClick={() => navigate(`/feed#${post.id}`)}
                        className="rounded-full bg-slate-100 px-4 py-2 text-[#1877f2] transition hover:bg-[#e7f3ff]"
                      >
                        فتح المنشور
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          <aside className="min-w-0 space-y-4">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-black text-brand-dark">ملخص المنشورات</h3>
              <div className="mt-4 space-y-3">
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-black text-brand-dark">{lawyerPosts.length.toLocaleString('ar-IQ')}</span>
                  <span className="text-sm font-bold text-slate-500">منشور</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-black text-brand-dark">{lawyerPosts.reduce((sum, post) => sum + post.likesCount, 0).toLocaleString('ar-IQ')}</span>
                  <span className="text-sm font-bold text-slate-500">إعجاب</span>
                </div>
                <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-3">
                  <span className="font-black text-brand-dark">{lawyerPosts.filter((post) => post.mediaUrl).length.toLocaleString('ar-IQ')}</span>
                  <span className="text-sm font-bold text-slate-500">وسائط</span>
                </div>
              </div>
            </div>
          </aside>
        </section>
      )}

      {activeTab === 'reviews' && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-brand-dark">المراجعات</h3>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {reviews.map((review) => (
              <div key={review.id} className="rounded-[1.75rem] border border-slate-100 bg-slate-50/60 p-5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-slate-400">{review.time}</span>
                  <p className="text-sm font-black text-brand-dark">{review.author}</p>
                </div>
                <p className="mt-3 text-amber-500">{'★'.repeat(review.rating)}</p>
                <p className="mt-3 text-sm font-bold leading-7 text-slate-600">{review.text}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-black text-brand-dark">النشاط الأخير</h3>
          <div className="mt-6 space-y-4">
            {activityItems.map((item) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between rounded-[1.75rem] border border-slate-100 bg-slate-50/60 px-5 py-4"
              >
                <div className="text-right">
                  <p className="text-sm font-black text-brand-dark">{item.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{item.note}</p>
                </div>
                <span className="text-xs font-black text-slate-400">{item.time}</span>
              </motion.div>
            ))}
          </div>
        </section>
      )}
      {activeStory && (
        <div className="fixed inset-0 z-[700] flex items-center justify-center bg-black/85 p-4">
          <button type="button" onClick={() => setActiveStoryIndex(null)} className="absolute left-5 top-5 h-10 w-10 rounded-full bg-white/10 text-white hover:bg-white/20">
            <i className="fa-solid fa-xmark"></i>
          </button>
          <article className="relative aspect-[9/16] max-h-[86vh] w-full max-w-sm overflow-hidden rounded-2xl bg-slate-950 shadow-2xl">
            <div className="absolute inset-x-0 top-0 z-20 space-y-3 p-4">
              <div className="flex gap-1.5">
                {lawyerStories.map((story, index) => (
                  <button
                    key={story.id}
                    type="button"
                    onClick={() => {
                      setActiveStoryIndex(index);
                      markStorySeen(story);
                    }}
                    className="h-1 flex-1 overflow-hidden rounded-full bg-white/25"
                    title={`القصة ${index + 1}`}
                  >
                    <span
                      className="block h-full rounded-full bg-white transition-[width] duration-75"
                      style={{
                        width:
                          activeStoryIndex === null
                            ? '0%'
                            : index < activeStoryIndex
                              ? '100%'
                              : index === activeStoryIndex
                                ? `${storyProgress}%`
                                : '0%',
                      }}
                    />
                  </button>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="rounded-full bg-black/30 px-2.5 py-1 text-[10px] font-black text-white backdrop-blur">
                  {(activeStoryIndex ?? 0) + 1} / {lawyerStories.length}
                </span>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 text-right">
                    <p className="truncate text-sm font-black text-white">{lawyer.name}</p>
                    <p className="text-[11px] font-bold text-white/70">{lawyer.specialty}</p>
                  </div>
                  <img src={lawyer.avatar} alt={lawyer.name} className="h-10 w-10 rounded-full border-2 border-white/70 object-cover" />
                </div>
              </div>
            </div>
            {activeStory.mediaUrl ? (
              activeStory.mediaType === 'video' ? (
                <video src={activeStory.mediaUrl} controls autoPlay className="h-full w-full object-contain" />
              ) : (
                <img src={activeStory.mediaUrl} alt="" className="h-full w-full object-contain" />
              )
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${lawyer.accent}`} />
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-black/75 to-transparent" />
            <button
              type="button"
              onClick={() => goToStory(-1)}
              disabled={activeStoryIndex === 0}
              className="absolute right-0 top-0 z-10 h-full w-1/2 cursor-pointer disabled:cursor-default"
              title="القصة السابقة"
            />
            <button
              type="button"
              onClick={() => goToStory(1)}
              className="absolute left-0 top-0 z-10 h-full w-1/2 cursor-pointer"
              title="القصة التالية"
            />
            {activeStoryIndex !== 0 && (
              <button
                type="button"
                onClick={() => goToStory(-1)}
                className="absolute right-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
                title="السابق"
              >
                <i className="fa-solid fa-chevron-right text-xs"></i>
              </button>
            )}
            {activeStoryIndex !== null && activeStoryIndex < lawyerStories.length - 1 && (
              <button
                type="button"
                onClick={() => goToStory(1)}
                className="absolute left-3 top-1/2 z-30 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition hover:bg-black/50"
                title="التالي"
              >
                <i className="fa-solid fa-chevron-left text-xs"></i>
              </button>
            )}
            {activeStory.text && (
              <div className="absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-black/80 to-transparent p-5">
                <p className="text-center text-lg font-black leading-8 text-white">{activeStory.text}</p>
              </div>
            )}
          </article>
        </div>
      )}
      {/* NotificationToast is now rendered globally by NotificationProvider, removed local toast */}
    </div>
  );
}
