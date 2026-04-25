import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import FollowButton from '../components/FollowButton';
import ActionButton from '../components/ui/ActionButton';
import { useNotifications } from '../context/NotificationContext';
import NoticePanel from '../components/ui/NoticePanel';
import StatusBadge from '../components/ui/StatusBadge';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';
import apiClient from '../api/client';

type PublicTab = 'overview' | 'reviews' | 'activity';

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
  const { NotificationBell, notifications, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications } = useNotifications(); // Use global notifications
  const [activeTab, setActiveTab] = useState<PublicTab>('overview');
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const { isFollowed, isPending, toggleFollow } = useFollowedLawyers();
  const [lawyer, setLawyer] = useState<any | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [activityItems, setActivityItems] = useState<any[]>([]);
  const [relatedLawyers, setRelatedLawyers] = useState<any[]>([]);
  const [loadError, setLoadError] = useState('');

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
        setLawyer(profileResponse.data.lawyer);
        setReviews(profileResponse.data.reviews || []);
        setActivityItems(profileResponse.data.activity || []);
        setRelatedLawyers((lawyersResponse.data || []).filter((item: any) => item.id !== params.id && item.specialty === profileResponse.data.lawyer.specialty).slice(0, 2));
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

  if (!lawyer && loadError) {
    return (
      <div className="app-view text-right">
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
    return <div className="app-view text-right">جاري تحميل الملف...</div>;
  }

  const isFollowing = isFollowed(lawyer.id);
  const socialProofText = `${lawyer.followers.toLocaleString()} متابع • ${lawyer.reviewCount} مراجعة موثقة • ${lawyer.casesHandled}`;

  const credentialBadges = [
    `رقم النقابة: ${lawyer.license}`,
    `المرفقات: ${lawyer.attachments.length} / 3`,
    `درجة الملف: ${lawyer.profileScore ?? 0}%`,
    `الانضمام: ${lawyer.submittedAt ?? 'غير محدد'}`,
  ];

  return (
    <div className="app-view space-y-6 pb-24 text-right">
      <section className="rounded-[2.75rem] border border-brand-navy/10 bg-gradient-to-l from-white via-slate-50 to-brand-navy/[0.05] p-8 shadow-premium">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_360px]">
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-end gap-2">
              {lawyer.verified && (
                <StatusBadge tone="info">
                  <i className="fa-solid fa-circle-check"></i>
                  محامٍ موثق
                </StatusBadge>
              )}
              <StatusBadge tone="warning" className="bg-white text-brand-gold border-brand-gold/20 shadow-sm">
                {lawyer.specialty}
              </StatusBadge>
            </div>

            <div className="flex flex-col gap-5 sm:flex-row-reverse sm:items-start">
              <img src={lawyer.avatar} alt={lawyer.name} className="h-24 w-24 rounded-[2rem] object-cover shadow-lg" />
              <div className="flex-1 space-y-3">
                <div>
                  <h1 className="text-4xl font-black leading-tight text-brand-dark">{lawyer.name}</h1>
                  <p className="mt-2 text-lg font-bold text-slate-500">{lawyer.tagline}</p>
                </div>
                <div className="flex flex-wrap items-center justify-end gap-4 text-sm font-black text-slate-500">
                  <span><i className="fa-solid fa-location-dot ml-1 text-brand-gold"></i>{lawyer.location}</span>
                  <span><i className="fa-solid fa-briefcase ml-1 text-brand-gold"></i>{lawyer.experience}</span>
                  <span><i className="fa-solid fa-clock ml-1 text-brand-gold"></i>{lawyer.responseTime}</span>
                </div>
                <p className="max-w-3xl text-sm font-bold leading-7 text-slate-600">{lawyer.bio}</p>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-4">
              <PublicStat label="التقييم" value={lawyer.rating.toFixed(1)} note={`${lawyer.reviewCount} مراجعة`} />
              <PublicStat label="المتابعون" value={lawyer.followers.toLocaleString()} note="دليل اجتماعي قوي" />
              <PublicStat label="الخبرة" value={`${lawyer.experienceYears}`} note="سنوات ممارسة" />
              <PublicStat label="القضايا" value={lawyer.casesHandled} note="ملفات أُنجزت بنجاح" />
            </div>
          </div>

          <aside className="rounded-[2.25rem] border border-slate-200 bg-white p-5 shadow-sm">
            <div className={`rounded-[2rem] bg-gradient-to-br ${lawyer.accent} p-5 text-white`}>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-white/75">Trust Snapshot</p>
              <p className="mt-3 text-2xl font-black">{lawyer.name}</p>
              <p className="mt-2 text-sm font-bold text-white/80">{socialProofText}</p>
              <div className="mt-5 flex items-center justify-between rounded-2xl bg-white/10 px-4 py-3">
                <span className="text-sm font-black">{lawyer.availability}</span>
                <span className={`h-3.5 w-3.5 rounded-full ${lawyer.isOnline ? 'bg-emerald-400' : 'bg-white/45'}`}></span>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <div className="flex gap-3">
                <button
                  onClick={() => setNotificationsEnabled((current) => !current)}
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${notificationsEnabled ? 'border-brand-gold bg-brand-gold/10 text-brand-dark' : 'border-slate-200 bg-slate-50 text-slate-400'}`}
                  title="تنبيهات النشاط"
                >
                  <i className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}></i>
                </button>
                <FollowButton isFollowing={isFollowing} isLoading={isPending(lawyer.id)} onToggle={() => toggleFollow(lawyer.id)} className="flex-1" />
              </div>
              <ActionButton
                onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)}
                variant="primary"
                className="w-full"
              >
                تواصل الآن
              </ActionButton>
              <ActionButton
                onClick={() => navigate('/cases', { state: { openNewCase: true, preselectedLawyerId: lawyer.id } })}
                variant="secondary"
                className="w-full"
              >
                افتح قضية مع هذا المحامي
              </ActionButton>
            </div>

            <div className="mt-5 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/60 p-4">
              <p className="text-sm font-black text-emerald-700">لماذا يثق به العملاء؟</p>
              <ul className="mt-3 space-y-2 text-xs font-bold text-slate-600">
                {lawyer.highlights.map((item) => (
                  <li key={item} className="flex items-center justify-end gap-2">
                    <span>{item}</span>
                    <i className="fa-solid fa-circle-check text-emerald-500"></i>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-5 rounded-[1.75rem] border border-slate-200 bg-slate-50/60 p-4">
              <p className="text-sm font-black text-brand-dark">الاعتماد والجاهزية</p>
              <div className="mt-3 flex flex-wrap justify-end gap-2">
                {credentialBadges.map((item) => (
                  <span key={item} className="rounded-full bg-white px-3 py-2 text-[11px] font-black text-slate-600 shadow-sm">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </section>

      <div className="sticky top-16 z-30 rounded-[1.75rem] border border-slate-200 bg-white/90 p-4 shadow-sm backdrop-blur-md">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-wrap justify-end gap-2">
            {[
              { id: 'overview' as const, label: 'Overview' },
              { id: 'reviews' as const, label: 'Reviews' },
              { id: 'activity' as const, label: 'Activity' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`rounded-full px-4 py-2 text-sm font-black transition ${activeTab === tab.id
                  ? 'bg-brand-navy text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-brand-navy'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap justify-end gap-3">
            <button
              onClick={() => setIsNotificationsOpen(!isNotificationsOpen)}
              className="relative h-12 w-12 flex items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 hover:text-brand-navy hover:shadow-md transition-all"
            > {/* Removed local NotificationBell and dropdown, now handled by global context */}
              <NotificationBell /> {/* Use the NotificationBell component from context */}
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute top-full right-0 mt-3 w-80 bg-white border border-slate-200 rounded-[2rem] shadow-2xl z-50 overflow-hidden text-right origin-top-right"
                  >
                    <div className="p-4 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
                      <button onClick={clearAllNotifications} className="text-[10px] font-black text-slate-400 hover:text-red-500">مسح الكل</button>
                      <h4 className="text-xs font-black text-brand-dark">التنبيهات</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto custom-scrollbar">
                      {notifications.length > 0 ? notifications.map(n => (
                        <div
                          key={n.id}
                          onClick={() => { markAsRead(n.id); if (n.link) navigate(n.link); setIsNotificationsOpen(false); }}
                          className={`p-4 border-b border-slate-50 last:border-0 hover:bg-slate-50 transition cursor-pointer ${!n.read ? 'bg-brand-navy/[0.02]' : ''}`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[9px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                            <p className={`text-xs font-black ${!n.read ? 'text-brand-navy' : 'text-slate-600'}`}>{n.title}</p>
                          </div>
                          <p className="text-[11px] font-bold text-slate-500 leading-relaxed">{n.message}</p>
                        </div>
                      )) : (
                        <div className="p-10 text-center text-slate-300">
                          <i className="fa-solid fa-bell-slash text-3xl mb-3 opacity-20"></i>
                          <p className="text-xs font-bold">لا توجد تنبيهات جديدة</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
            <button
              onClick={() => setNotificationsEnabled((current) => !current)}
              className={`flex h-12 w-12 items-center justify-center rounded-2xl border transition ${notificationsEnabled ? 'border-brand-gold bg-brand-gold/10 text-brand-dark' : 'border-slate-200 bg-slate-100 text-slate-400'}`}
            >
              <i className={`fa-solid ${notificationsEnabled ? 'fa-bell' : 'fa-bell-slash'}`}></i>
            </button>
            <FollowButton isFollowing={isFollowing} isLoading={isPending(lawyer.id)} onToggle={() => toggleFollow(lawyer.id)} />
            <ActionButton
              onClick={() => navigate(`/messages?lawyerId=${encodeURIComponent(lawyer.id)}`)}
              variant="ghost"
            >
              تواصل
            </ActionButton>
          </div>
        </div>
      </div>

      {activeTab === 'overview' && (
        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-6">
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
                    {item}
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

          <aside className="space-y-6">
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
      {/* NotificationToast is now rendered globally by NotificationProvider, removed local toast */}
    </div>
  );
}
