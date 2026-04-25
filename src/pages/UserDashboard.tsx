import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AnimatePresence, motion } from 'framer-motion';
import FollowButton from '../components/FollowButton';
import { useNotifications } from '../context/NotificationContext';
import NoticePanel from '../components/ui/NoticePanel';
import { FOLLOW_STATE_EVENT, useFollowedLawyers } from '../hooks/useFollowedLawyers';
import apiClient from '../api/client';

interface MainLayoutContext {
  setSosOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

type DashboardTab = 'overview' | 'cases' | 'services' | 'assist' | 'documents' | 'schedule' | 'payments';
type HeaderRange = 'today' | 'week' | 'month';
type HeaderFocus = 'all' | 'urgent' | 'pending';

interface CaseItem {
  id: string;
  title: string;
  subtitle: string;
  progress: number;
  status: string;
  urgency: 'عالي' | 'متوسط' | 'منخفض';
  nextStep: string;
  lawyer: string;
  deadline: string;
  icon: string;
  tone: string;
  milestones: Array<{ id: string; label: string; status: 'completed' | 'current' | 'upcoming' }>;
  unread?: boolean;
}

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  caseName: string;
  updatedAt: string;
  status: 'مكتمل' | 'مطلوب' | 'قيد المراجعة';
}

interface ScheduleItem {
  id: string;
  title: string;
  time: string;
  type: string;
  caseName: string;
}

interface PaymentItem {
  id: string;
  label: string;
  amount: string;
  status: string;
  date: string;
}

interface LegalService {
  id: string;
  title: string;
  description: string;
  icon: string;
  price: string;
  time: string;
  color: string;
  category: string;
}

interface LawyerItem {
  id: string;
  name: string;
  specialty: 'أحوال شخصية' | 'قضايا تجارية' | 'عقارات' | 'ملكية فكرية';
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
}

interface DashboardSummary {
  activeCases: number;
  actionRequiredCases: number;
  requiredDocuments: number;
  totalDocuments: number;
  completedDocuments: number;
  fileHealth: number;
  accountBalance: number;
}

const DASHBOARD_TABS: Array<{
  id: DashboardTab;
  label: string;
  description: string;
  icon: string;
  accent: string;
}> = [
    { id: 'overview', label: 'الرئيسية', description: 'الصورة العامة وأهم الإجراءات', icon: 'fa-solid fa-house-chimney', accent: 'brand-navy' },
    { id: 'cases', label: 'قضاياي', description: 'خريطة الطريق ومتابعة الإجراءات', icon: 'fa-solid fa-folder-open', accent: 'blue-600' },
    { id: 'services', label: 'الخدمات', description: 'استعراض وطلب الخدمات القانونية', icon: 'fa-solid fa-hand-holding-heart', accent: 'brand-gold' },
    { id: 'assist', label: 'المساعد الذكي', description: 'AI Chat والمسارات السريعة', icon: 'fa-solid fa-brain', accent: 'indigo-600' },
    { id: 'documents', label: 'المستندات', description: 'الملفات المطلوبة والمرفوعة', icon: 'fa-solid fa-file-lines', accent: 'emerald-600' },
    { id: 'schedule', label: 'المواعيد', description: 'الجلسات، التذكيرات، والمواعيد القادمة', icon: 'fa-regular fa-calendar-check', accent: 'brand-gold' },
    { id: 'payments', label: 'المدفوعات', description: 'الرصيد، الفواتير، والتكاليف', icon: 'fa-solid fa-wallet', accent: 'slate-700' },
  ];

const QUICK_ACTIONS = [
  { id: 'start', label: 'ابدأ خدمة جديدة', note: 'لإنشاء طلب أو اختيار خدمة قانونية مناسبة', icon: 'fa-solid fa-compass-drafting' },
  { id: 'upload', label: 'رفع مستند مطلوب', note: 'أرسل الملفات الناقصة لإكمال قضيتك الحالية', icon: 'fa-solid fa-upload' },
  { id: 'book', label: 'حجز موعد', note: 'نسّق جلسة مع محامٍ متخصص للحالة الحالية', icon: 'fa-regular fa-calendar-check' },
  { id: 'ai', label: 'اسأل المساعد الذكي', note: 'احصل على شرح سريع أو تلخيص للخطوة التالية', icon: 'fa-solid fa-comments' },
];

const HEADER_RANGE_OPTIONS: Array<{ value: HeaderRange; label: string }> = [
  { value: 'today', label: 'اليوم' },
  { value: 'week', label: 'آخر 7 أيام' },
  { value: 'month', label: 'هذا الشهر' },
];

const HEADER_FOCUS_OPTIONS: Array<{ value: HeaderFocus; label: string }> = [
  { value: 'all', label: 'كل الأنشطة' },
  { value: 'urgent', label: 'الأولوية العالية' },
  { value: 'pending', label: 'بانتظارك' },
];

export default function UserDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { NotificationBell, notifications, isNotificationsOpen, setIsNotificationsOpen, markAsRead, clearAllNotifications } = useNotifications(); // Use global notifications
  const { setSosOpen } = useOutletContext<MainLayoutContext>();
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState<{
    summary: DashboardSummary;
    cases: CaseItem[];
    documents: DocumentItem[];
    schedule: ScheduleItem[];
    payments: PaymentItem[];
    lawyers: LawyerItem[];
    services: LegalService[];
  } | null>(null);

  const { followedIds: followedLawyers, toggleFollow, isPending, totalFollowed } = useFollowedLawyers();

  const [serviceCategory, setServiceCategory] = useState<string>('الكل');

  const cases = dashboardData?.cases ?? [];
  const documents = dashboardData?.documents ?? [];
  const schedule = dashboardData?.schedule ?? [];
  const payments = dashboardData?.payments ?? [];
  const lawyers = dashboardData?.lawyers ?? [];
  const services = dashboardData?.services ?? [];
  const summary = dashboardData?.summary;
  const availableBalance = summary?.accountBalance ?? user?.accountBalance ?? 0;

  const serviceCategories = useMemo(() => ['الكل', ...Array.from(new Set(services.map(s => s.category)))], [services]);

  const filteredServices = useMemo(() => {
    if (serviceCategory === 'الكل') return services;
    return services.filter(s => s.category === serviceCategory);
  }, [serviceCategory, services]);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');

  useEffect(() => {
    const load = async () => {
      setIsInitialLoading(true);
      try {
        const response = await apiClient.getDashboard();
        setDashboardData(response.data);
      } catch (error) {
        console.error('Failed to load dashboard', error);
      } finally {
        setIsInitialLoading(false);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const handleFollowStateChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ lawyerId: string; delta: number; followerCount?: number }>;
      const { lawyerId, delta, followerCount } = customEvent.detail;

      setDashboardData((current) =>
        current
          ? {
              ...current,
              lawyers: current.lawyers.map((lawyer) =>
                lawyer.id === lawyerId
                  ? {
                      ...lawyer,
                      followers: typeof followerCount === 'number' ? followerCount : Math.max(0, (lawyer.followers ?? 0) + delta),
                    }
                  : lawyer,
              ),
            }
          : current,
      );
    };

    window.addEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
    return () => window.removeEventListener(FOLLOW_STATE_EVENT, handleFollowStateChange as EventListener);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setIsCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleStatClick = (label: string) => {
    if (label === 'القضايا النشطة') {
      setActiveTab('cases');
    } else if (label === 'المستندات المطلوبة') {
      setActiveTab('documents');
    } else if (label === 'صحة الملف') {
      setActiveTab('documents');
    } else if (label === 'الرصيد') {
      setActiveTab('payments');
    }
  };

  const [activeTab, setActiveTab] = useState<DashboardTab>(() => {
    if (typeof window === 'undefined') return 'overview';
    const stored = window.localStorage.getItem('lexigate-user-dashboard-tab') as DashboardTab | null;
    return stored ?? 'overview';
  });
  const [selectedCaseId, setSelectedCaseId] = useState<string>(
    () => window.localStorage.getItem('lexigate-user-dashboard-case') ?? ''
  );
  const [headerRange, setHeaderRange] = useState<HeaderRange>('week');
  const [headerFocus, setHeaderFocus] = useState<HeaderFocus>('all');
  const [lawyerQuery, setLawyerQuery] = useState('');
  const [lawyerSpecialty, setLawyerSpecialty] = useState<'الكل' | LawyerItem['specialty']>('الكل');
  const [selectedLawyerId, setSelectedLawyerId] = useState<string>('');

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return [];

    const items = [
      ...cases.map((c) => ({ id: c.id, type: 'قضية', title: c.title, subtitle: c.status, icon: 'fa-folder-open', action: () => { setSelectedCaseId(c.id); setActiveTab('cases'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
      ...services.map((s) => ({ id: s.id, type: 'خدمة', title: s.title, subtitle: s.price, icon: 'fa-hand-holding-heart', action: () => { setActiveTab('services'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
      ...documents.map((d) => ({ id: d.id, type: 'مستند', title: d.name, subtitle: d.caseName, icon: 'fa-file-lines', action: () => { setActiveTab('documents'); setIsCommandPaletteOpen(false); setCommandQuery(''); } })),
    ];

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
    );
  }, [cases, commandQuery, documents, services, setSelectedCaseId, setActiveTab, setIsCommandPaletteOpen, setCommandQuery]);

  // اقتراح: ترحيب مخصص حسب الوقت
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'صباح الخير';
    if (hour < 18) return 'طاب يومك';
    return 'مساء الخير';
  }, []);

  const selectedCase = useMemo(
    () => cases.find((item) => item.id === selectedCaseId) ?? cases[0],
    [cases, selectedCaseId]
  );

  const activeTabMeta = useMemo(
    () => DASHBOARD_TABS.find((tab) => tab.id === activeTab) ?? DASHBOARD_TABS[0],
    [activeTab]
  );

  const filteredLawyers = useMemo(() => {
    const normalizedQuery = lawyerQuery.trim();

    return lawyers.filter((lawyer) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        lawyer.name.includes(normalizedQuery) ||
        lawyer.location.includes(normalizedQuery) ||
        lawyer.specialty.includes(normalizedQuery);

      const matchesSpecialty = lawyerSpecialty === 'الكل' || lawyer.specialty === lawyerSpecialty;

      return matchesQuery && matchesSpecialty;
    }).sort((left, right) => {
      const leftFollowed = followedLawyers.includes(left.id) ? 1 : 0;
      const rightFollowed = followedLawyers.includes(right.id) ? 1 : 0;
      if (leftFollowed !== rightFollowed) return rightFollowed - leftFollowed;
      return right.rating - left.rating;
    });
  }, [followedLawyers, lawyerQuery, lawyerSpecialty, lawyers]);

  const myFollowing = useMemo(
    () => lawyers.filter((lawyer) => followedLawyers.includes(lawyer.id)).slice(0, 3),
    [followedLawyers, lawyers]
  );

  const requiredDocuments = useMemo(
    () => documents.filter((doc) => doc.status === 'مطلوب'),
    [documents]
  );

  const nextActionCase = useMemo(
    () => cases.find((item) => item.status === 'بانتظارك') ?? cases.find((item) => item.unread) ?? cases[0],
    [cases]
  );

  const upcomingScheduleItem = useMemo(() => schedule[0], [schedule]);

  const selectedLawyer = useMemo(
    () => filteredLawyers.find((lawyer) => lawyer.id === selectedLawyerId) ?? filteredLawyers[0] ?? lawyers[0] ?? null,
    [filteredLawyers, lawyers, selectedLawyerId]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lexigate-user-dashboard-tab', activeTab);
  }, [activeTab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('lexigate-user-dashboard-case', selectedCaseId);
  }, [selectedCaseId]);

  const stats = useMemo(
    () => {
      const activeCases = summary?.activeCases ?? cases.length;
      const actionRequiredCases = summary?.actionRequiredCases ?? cases.filter((item) => item.status === 'بانتظارك' || item.unread).length;
      const pendingDocuments = summary?.requiredDocuments ?? requiredDocuments.length;
      const totalDocuments = summary?.totalDocuments ?? documents.length;
      const fileHealth = summary?.fileHealth ?? (totalDocuments > 0 ? Math.round((documents.filter((item) => item.status === 'مكتمل').length / totalDocuments) * 100) : 0);
      const healthyCasesProgress = activeCases > 0 ? Math.round(((activeCases - actionRequiredCases) / activeCases) * 100) : 0;
      const documentsProgress = totalDocuments > 0 ? Math.round(((totalDocuments - pendingDocuments) / totalDocuments) * 100) : 0;

      return [
        {
          label: 'القضايا النشطة',
          value: activeCases.toLocaleString('ar-IQ'),
          note: activeCases === 0 ? 'لا توجد قضايا نشطة حالياً' : actionRequiredCases > 0 ? `منها ${actionRequiredCases.toLocaleString('ar-IQ')} تحتاج إجراء منك` : 'كل القضايا تحت المتابعة',
          icon: 'fa-solid fa-briefcase',
          tone: 'text-brand-navy',
          progress: healthyCasesProgress,
          color: 'bg-brand-navy',
        },
        {
          label: 'المستندات المطلوبة',
          value: pendingDocuments.toLocaleString('ar-IQ'),
          note: pendingDocuments === 0 ? 'لا توجد مستندات مطلوبة الآن' : `${pendingDocuments.toLocaleString('ar-IQ')} جاهزة للرفع الآن`,
          icon: 'fa-solid fa-file-shield',
          tone: 'text-amber-600',
          progress: documentsProgress,
          color: 'bg-amber-500',
        },
        {
          label: 'صحة الملف',
          value: `${fileHealth.toLocaleString('ar-IQ')}%`,
          note: totalDocuments === 0 ? 'أضف أول مستند لبدء تقييم الملف' : pendingDocuments > 0 ? `أكمل ${pendingDocuments.toLocaleString('ar-IQ')} مستند لتحسينه` : 'ملفك القانوني في وضع جيد',
          icon: 'fa-solid fa-heart-pulse',
          tone: 'text-emerald-600',
          progress: fileHealth,
          color: 'bg-emerald-500',
        },
        {
          label: 'الرصيد',
          value: availableBalance.toLocaleString('ar-IQ'),
          note: 'IQD متاح',
          icon: 'fa-solid fa-vault',
          tone: 'text-brand-gold',
          progress: 100,
          color: 'bg-brand-gold',
        },
      ];
    },
    [availableBalance, cases, documents, requiredDocuments.length, summary]
  );

  const guidedPaths = useMemo(
    () => [
      { id: 'p1', title: 'تأسيس شركة محدودة', steps: '6 خطوات', icon: 'fa-solid fa-building-columns', color: 'bg-indigo-50 text-indigo-600' },
      { id: 'p2', title: 'تسجيل علامة تجارية', steps: '4 خطوات', icon: 'fa-solid fa-copyright', color: 'bg-rose-50 text-red-600' },
      { id: 'p3', title: 'توثيق عقد عقاري', steps: '5 خطوات', icon: 'fa-solid fa-house-chimney-user', color: 'bg-amber-50 text-amber-600' },
    ],
    []
  );

  const urgentItems = useMemo(
    () => [
      { id: 'u1', title: 'رفع كشف الحساب البنكي', note: 'ضروري لإكمال المطالبة المالية', cta: 'رفع الآن', priority: 'high', icon: 'fa-solid fa-cloud-arrow-up', action: () => setActiveTab('documents') },
      { id: 'u2', title: 'الاطلاع على رد العلامة التجارية', note: 'تمت إضافة رد جديد من المحامي', cta: 'فتح القضية', priority: 'medium', icon: 'fa-solid fa-envelope-open-text', action: () => { setSelectedCaseId('case-2'); setActiveTab('cases'); } },
      { id: 'u3', title: 'مكالمة متابعة اليوم', note: 'مع د. عمر النعيمي الساعة 07:00 م', cta: 'عرض الموعد', priority: 'low', icon: 'fa-solid fa-phone-volume', action: () => setActiveTab('schedule') },
    ],
    []
  );

  const handleQuickAction = (actionId: string) => {
    if (actionId === 'start') {
      setActiveTab('services');
      return;
    }
    if (actionId === 'sos') {
      setSosOpen(true);
      return;
    }
    if (actionId === 'ai') {
      navigate('/aichat');
      return;
    }
    if (actionId === 'upload') {
      setActiveTab('documents');
      return;
    }
    setActiveTab('schedule');
  };

  const getLawyerInitial = (lawyer: LawyerItem) => lawyer.name.split(' ').slice(-1)[0].charAt(0);

  const renderLawyerFinder = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-right">
            <h3 className="text-lg font-bold text-brand-dark">ابحث عن محامٍ من القائمة</h3>
            <p className="text-sm text-slate-500 font-bold">ابحث بالاسم أو التخصص أو المدينة، ثم اختر المحامي الأنسب لحالتك.</p>
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('schedule')}
            className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
          >
            حجز موعد
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px]">
          <label className="text-right">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">بحث سريع</span>
            <div className="relative">
              <input
                type="search"
                value={lawyerQuery}
                onChange={(event) => setLawyerQuery(event.target.value)}
                placeholder="ابحث باسم المحامي أو التخصص أو المدينة"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pl-11 text-sm text-right text-slate-700 outline-none transition focus:border-brand-navy"
              />
              <i className="fa-solid fa-magnifying-glass pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400"></i>
            </div>
          </label>

          <label className="text-right">
            <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">التخصص</span>
            <div className="relative">
              <select
                value={lawyerSpecialty}
                onChange={(event) => setLawyerSpecialty(event.target.value as 'الكل' | LawyerItem['specialty'])}
                className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-navy"
              >
                <option value="الكل">كل التخصصات</option>
                <option value="أحوال شخصية">أحوال شخصية</option>
                <option value="قضايا تجارية">قضايا تجارية</option>
                <option value="عقارات">عقارات</option>
                <option value="ملكية فكرية">ملكية فكرية</option>
              </select>
              <i className="fa-solid fa-chevron-down pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
            </div>
          </label>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-2">
          {myFollowing.length > 0 && (
            <div className="sm:col-span-2 rounded-3xl border border-emerald-100 bg-emerald-50/60 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-right">
                  <p className="text-sm font-black text-brand-dark">قائمة المتابعة</p>
                  <p className="text-xs font-bold text-slate-500">المتابَعون يظهرون أولًا في النتائج لتسهيل العودة السريعة إلى المحامين الموثوقين لديك.</p>
                </div>
                <span className="rounded-full bg-white px-3 py-2 text-xs font-black text-emerald-700 shadow-sm">
                  {totalFollowed} متابَع
                </span>
              </div>
              <div className="mt-4 flex flex-wrap justify-end gap-3">
                {myFollowing.map((lawyer) => (
                  <button
                    key={lawyer.id}
                    type="button"
                    onClick={() => setSelectedLawyerId(lawyer.id)}
                    className="inline-flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-brand-navy/20"
                  >
                    <div className="text-right">
                      <p className="text-sm font-black text-brand-dark">{lawyer.name}</p>
                      <p className="text-[11px] font-bold text-slate-500">{lawyer.specialty} • {lawyer.rating}</p>
                    </div>
                    <img src={lawyer.avatar} alt={lawyer.name} className="h-11 w-11 rounded-2xl object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}
          {filteredLawyers.length > 0 ? (
            filteredLawyers.map((lawyer) => (
              <button
                key={lawyer.id}
                type="button"
                onClick={() => setSelectedLawyerId(lawyer.id)}
                title={`عرض بطاقة ${lawyer.name}`}
                className={`group relative overflow-hidden rounded-2xl border bg-white text-right transition-all duration-300 ${selectedLawyer.id === lawyer.id
                  ? 'border-brand-navy ring-2 ring-brand-navy/5 shadow-xl scale-[1.02] z-10' :
                  followedLawyers.includes(lawyer.id) ? 'border-brand-gold bg-brand-gold/5 shadow-premium'
                    : 'hover:-translate-y-1 hover:border-brand-navy/40 hover:shadow-[0_30px_90px_-44px_rgba(15,23,42,0.22)]'
                  }`}
              >
                <div className={`absolute inset-y-0 right-0 w-1.5 bg-gradient-to-b ${lawyer.accent}`}></div>
                <div className="p-3.5 pr-5">
                  <div className="relative rounded-2xl bg-gradient-to-bl from-slate-50 to-white p-3 shadow-inner border border-slate-100/50">
                    <div className="flex flex-row-reverse items-start gap-3">
                      <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl border-2 border-white bg-slate-100 shadow-sm">
                        <img
                          src={lawyer.avatar}
                          alt={lawyer.name}
                          className="h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none';
                          }}
                        />
                        <div className={`absolute inset-0 flex items-center justify-center bg-gradient-to-br ${lawyer.accent} text-xl font-bold text-white ${lawyer.avatar ? 'opacity-0 transition-opacity duration-200 group-hover:opacity-100' : 'opacity-100'}`}>
                          {getLawyerInitial(lawyer)}
                        </div>
                      </div>
                      <div className="space-y-2 text-right">
                        <div className="flex flex-wrap items-center justify-end gap-2">
                          <p title={lawyer.name} className="max-w-[220px] truncate text-xl font-semibold leading-tight text-slate-950">
                            {lawyer.name}
                          </p>
                          {lawyer.verified && (
                            <span className="inline-flex items-center justify-center rounded-full bg-sky-100 px-2.5 py-1 text-sky-700 ring-1 ring-sky-100">
                              <i className="fa-solid fa-check text-sm"></i>
                            </span>
                          )}
                          {followedLawyers.includes(lawyer.id) && (
                            <span className="bg-brand-gold text-brand-dark text-[8px] font-black uppercase px-2 py-0.5 rounded-md">متابع</span>
                          )}
                        </div>
                        <p className="max-w-[240px] text-sm leading-6 text-slate-600" title={lawyer.tagline}>
                          {lawyer.tagline}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap justify-end gap-2">
                      <span title={lawyer.specialty} className="truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                        {lawyer.specialty}
                      </span>
                      <span title={lawyer.consultationFee} className="truncate rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 shadow-sm">
                        {lawyer.consultationFee}
                      </span>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    <div title={lawyer.experience} className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-3 py-3 text-right text-slate-700 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">الخبرة</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{lawyer.experience}</p>
                    </div>
                    <div title={`${lawyer.rating} - ${lawyer.reviews}`} className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-3 py-3 text-right text-slate-700 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">التقييم</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{lawyer.rating} • {lawyer.reviews}</p>
                    </div>
                    <div title={lawyer.casesHandled} className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-3 py-3 text-right text-slate-700 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">القضايا</p>
                      <p className="mt-1 truncate text-sm font-semibold text-slate-950">{lawyer.casesHandled}</p>
                    </div>
                    <div title={lawyer.availability} className="rounded-[1.5rem] border border-slate-200 bg-white/90 px-3 py-3 text-right text-slate-700 shadow-sm">
                      <p className="text-[10px] uppercase tracking-[0.24em] text-slate-400">التوفر</p>
                      <p className={`mt-1 truncate text-sm font-semibold ${lawyer.isOnline ? 'text-emerald-600' : 'text-slate-600'}`}>{lawyer.availability}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <button
                      type="button"
                      onClick={() => navigate(`/profile/${lawyer.id}`, {
                        state: {
                          lawyer: {
                            id: lawyer.id,
                            name: lawyer.name,
                            city: lawyer.location,
                            specialty: lawyer.specialty,
                            status: 'approved',
                            license: 'IRQ-2024-XXX'
                          }
                        }
                      })}
                      title={`عرض ملف ${lawyer.name}`}
                      className="rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition duration-200 hover:border-brand-navy hover:text-brand-navy active:scale-[0.98]"
                    >
                      الملف
                    </button>
                    <FollowButton
                      isFollowing={followedLawyers.includes(lawyer.id)}
                      isLoading={isPending(lawyer.id)}
                      onToggle={() => toggleFollow(lawyer.id)}
                      className="w-full rounded-2xl px-3 py-2"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLawyerId(lawyer.id);
                        setActiveTab('schedule');
                      }}
                      title={`حجز استشارة مع ${lawyer.name}`}
                      className="rounded-2xl bg-brand-navy px-3 py-2 text-sm font-semibold text-white transition duration-200 hover:bg-[#102d5e] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      احجز
                    </button>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-slate-50 px-4 py-6 text-right">
              <p className="text-sm font-bold text-brand-dark">لا توجد نتائج مطابقة حالياً</p>
              <p className="mt-1 text-xs text-slate-500">جرّب تغيير التخصص أو استخدام كلمة بحث مختلفة.</p>
            </div>
          )}
        </div>
      </section>

      <aside className="sticky top-24 self-start space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-right">
            <h3 className="text-base font-bold text-brand-dark">تفاصيل المحامي المختار</h3>
            <p className="text-xs text-slate-500">ملخص سريع لمساعدتك على اتخاذ القرار.</p>
          </div>
          <div className="mt-4 space-y-3">
            {selectedLawyer ? (
              <>
                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div className={`bg-gradient-to-br ${selectedLawyer.accent} p-4 text-right text-white`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white/90">
                            {selectedLawyer.specialty}
                          </span>
                          {selectedLawyer.verified && (
                            <span className="inline-flex items-center justify-center rounded-full bg-white/15 px-3 py-1 text-white/90">
                              <i className="fa-solid fa-check text-[11px]"></i>
                            </span>
                          )}
                        </div>
                        <p className="text-lg font-bold">{selectedLawyer.name}</p>
                        <p className="text-sm leading-6 text-white/80">{selectedLawyer.tagline}</p>
                      </div>
                      <div className="inline-flex h-14 w-14 items-center justify-center rounded-xl bg-white/15 text-lg font-bold text-white">
                        {getLawyerInitial(selectedLawyer)}
                      </div>
                    </div>
                    <div className="mt-4 flex items-center justify-between rounded-xl bg-white/10 px-3 py-3 text-sm">
                      <span className="font-bold">{selectedLawyer.rating} <i className="fa-solid fa-star mr-1 text-amber-300"></i></span>
                      <span className="text-white/80">{selectedLawyer.reviews}</span>
                    </div>
                  </div>
                  <div className="grid gap-3 p-4">
                    <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                      <p className="text-[11px] text-slate-400">الحالة الحالية</p>
                      <div
                        className={`mt-1 h-3.5 w-3.5 rounded-full ${selectedLawyer.isOnline ? 'bg-emerald-500' : 'bg-slate-400'}`}
                        title={selectedLawyer.isOnline ? 'متصل الآن' : 'غير متصل حالياً'}
                      />
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-navy hover:text-brand-navy active:scale-[0.99]"
                      >
                        عرض الملف
                      </button>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-navy hover:bg-white hover:text-brand-navy active:scale-[0.99]"
                      >
                        تواصل مباشر
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">المدينة</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedLawyer.location}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">الخبرة والإنجاز</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">
                    {selectedLawyer.experience} • {selectedLawyer.casesHandled}
                  </p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">رسوم الاستشارة</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedLawyer.consultationFee}</p>
                </div>
                <div className="rounded-xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">التوفر الحالي</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedLawyer.availability}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  title={`حجز استشارة مع ${selectedLawyer.name}`}
                  className="w-full rounded-2xl bg-brand-gold px-4 py-3 text-sm font-bold text-brand-dark transition duration-200 hover:bg-yellow-600 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  احجز الآن مع {selectedLawyer.name}
                </button>
              </>
            ) : (
              <p className="py-10 text-center text-xs text-slate-400 font-bold italic">اختر محامياً لعرض التفاصيل...</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );

  const renderOverview = () => (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_360px]">
        <section className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <h3 className="text-lg font-bold text-brand-dark">ما يحتاج انتباهك الآن</h3>
                <p className="text-sm text-slate-500">خطوات واضحة ومباشرة حتى لا تضيع أي متابعة مهمة.</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/aichat')}
                className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark"
              >
                فتح AI Chat
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {urgentItems.map((item) => (
                <div key={item.id} className={`rounded-3xl border-r-4 border border-slate-100 bg-slate-50/50 px-4 py-4 transition-colors hover:bg-white ${item.priority === 'high' ? 'border-r-red-500' : item.priority === 'medium' ? 'border-r-amber-500' : 'border-r-blue-500'}`}>
                  <div className="flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={item.action}
                      className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-brand-navy shadow-sm transition hover:border-brand-navy hover:bg-brand-navy hover:text-white"
                    >
                      {item.cta}
                    </button>
                    <div className="flex-1 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <p className="text-sm font-bold text-brand-dark">{item.title}</p>
                        <i className={`${item.icon} text-xs text-slate-400`}></i>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">{item.note}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <h3 className="text-lg font-bold text-brand-dark">ابدأ خطوة جديدة</h3>
                <p className="text-sm text-slate-500">ثلاثة مسارات واضحة: ابدأ خدمة، أكمل ما هو مطلوب، أو احجز موعداً.</p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => handleQuickAction(action.id)}
                  className="group rounded-3xl border border-slate-100 bg-slate-50/50 px-4 py-4 text-right transition-all hover:border-brand-navy/30 hover:bg-white hover:shadow-md"
                >
                  <div className="flex items-start gap-3">
                    <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-brand-navy shadow-sm transition-colors group-hover:bg-brand-navy group-hover:text-white">
                      <i className={action.icon}></i>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-brand-dark group-hover:text-brand-navy">{action.label}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{action.note}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* New Helpful Feature: Guided Paths */}
          <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="text-right">
                <h3 className="text-lg font-bold text-brand-dark">قضاياك الحالية</h3>
                <p className="text-sm text-slate-500">ملخص سريع للحالات الجارية حتى تعرف أين تتابع الآن.</p>
              </div>
              <button
                type="button"
                onClick={() => setActiveTab('cases')}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-brand-navy transition hover:border-brand-navy hover:bg-slate-50"
              >
                عرض كل القضايا
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {cases.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedCaseId(item.id);
                    setActiveTab('cases');
                  }}
                  className="rounded-3xl border border-slate-100 bg-slate-50/50 p-4 text-right transition-all hover:border-brand-navy/30 hover:bg-white"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-bold ${item.tone}`}>{item.status}</span>
                    <div className="text-right">
                      <p className="text-sm font-bold text-brand-dark">{item.title}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.nextStep}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{item.deadline}</span>
                    <span>{item.progress}% مكتمل</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-brand-dark">ملخص اليوم</h3>
            <div className="mt-4 grid gap-3">
              {stats.map((stat) => (
                <div key={stat.label} className="rounded-2xl border border-slate-100 bg-slate-50/50 px-4 py-4 text-right transition-colors hover:bg-white">
                  <div className="flex items-center justify-between mb-1">
                    <i className={`${stat.icon} ${stat.tone} opacity-60 text-sm`}></i>
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
                  </div>
                  <p className="mt-1 text-2xl font-black text-brand-dark">{stat.value}</p>
                  <p className="text-xs text-slate-500">{stat.note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-brand-dark">الخطوة التالية</h3>
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-4 text-right">
              {nextActionCase ? (
                <>
                  <p className="text-sm font-bold text-brand-dark">{nextActionCase.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{nextActionCase.nextStep}</p>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span>{nextActionCase.deadline}</span>
                    <span>{nextActionCase.lawyer}</span>
                  </div>
                </>
              ) : (
                <p className="text-sm text-slate-400 font-bold">لا توجد إجراءات حالية</p>
              )}
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-base font-bold text-brand-dark">مطلوب منك الآن</h3>
            <div className="mt-4 space-y-3">
              {requiredDocuments.map((doc) => (
                <button
                  key={doc.id}
                  type="button"
                  onClick={() => setActiveTab('documents')}
                  className="w-full rounded-2xl bg-red-50 px-4 py-3 text-right transition hover:bg-red-100/70"
                >
                  <p className="text-sm font-semibold text-red-700">{doc.name}</p>
                  <p className="mt-1 text-xs text-red-600">{doc.caseName}</p>
                </button>
              ))}
              {upcomingScheduleItem ? (
                <button
                  type="button"
                  onClick={() => setActiveTab('schedule')}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right transition hover:border-brand-navy hover:bg-white"
                >
                  <p className="text-sm font-semibold text-brand-dark">{upcomingScheduleItem.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{upcomingScheduleItem.time}</p>
                </button>
              ) : (
                <p className="text-xs text-slate-400 text-center py-2">لا توجد مواعيد قريبة</p>
              )}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );

  const renderCases = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_360px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div className="text-right flex-1">
              <h3 className="text-lg font-bold text-brand-dark">خريطة الطريق والتقدم</h3>
              <p className="text-sm text-slate-500">تتبع مراحل قضيتك من البداية حتى الإغلاق النهائي.</p>
            </div>
          </div>

          {/* Case Roadmap Visualization */}
          {selectedCase && (
            <div className="relative rounded-[2rem] bg-slate-50 p-6">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 relative">
                {/* Roadmap Track Line */}
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-slate-200 -translate-y-1/2 hidden md:block"></div>

                {selectedCase.milestones.map((ms, idx) => (
                  <div key={ms.id} className="relative z-10 flex flex-col items-center gap-3">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-full border-4 border-white shadow-sm transition-colors duration-500 ${ms.status === 'completed' ? 'bg-emerald-500 text-white' :
                      ms.status === 'current' ? 'bg-brand-gold text-brand-dark animate-pulse' :
                        'bg-slate-200 text-slate-400'
                      }`}>
                      {ms.status === 'completed' ? <i className="fa-solid fa-check text-xs"></i> : <span className="text-xs font-bold">{idx + 1}</span>}
                    </div>
                    <div className="text-center">
                      <p className={`text-xs font-bold ${ms.status === 'upcoming' ? 'text-slate-400' : 'text-brand-dark'}`}>{ms.label}</p>
                      {ms.status === 'current' && <span className="text-[9px] font-bold text-brand-gold uppercase tracking-widest">المرحلة الحالية</span>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cases Table - Responsive */}
          <div className="mt-8 overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
            <table className="w-full text-right text-sm md:table">
              <thead className="hidden bg-slate-50 text-[11px] uppercase font-black tracking-[0.2em] text-slate-400 md:table-header-group">
                <tr className="md:table-row">
                  <th className="px-4 py-3">القضية</th>
                  <th className="px-4 py-3">التقدم</th>
                  <th className="px-4 py-3">الأولوية</th>
                  <th className="px-4 py-3">الموعد</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 md:table-row-group">
                {cases.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedCaseId(item.id)}
                    className={`flex flex-col p-4 border border-slate-200 rounded-xl bg-white shadow-sm mb-3 md:table-row md:p-0 md:border-0 md:bg-transparent md:shadow-none md:mb-0 cursor-pointer transition-all ${selectedCaseId === item.id ? 'md:bg-brand-navy/[0.04]' : 'md:hover:bg-slate-50'}`}
                  >
                    <td className="md:table-cell md:px-4 md:py-4">
                      <div className="md:min-w-0">
                        <div className="flex items-center justify-end gap-2">
                          {item.unread && <span className="h-2.5 w-2.5 rounded-full bg-red-500"></span>}
                          <p className="truncate text-sm font-bold text-brand-dark">{item.title}</p>
                        </div>
                        <p className="mt-1 truncate text-xs text-slate-500">{item.nextStep}</p>
                      </div>
                    </td>
                    <td className="md:table-cell md:px-4 md:py-4">
                      <div className="flex flex-col md:block">
                        <span className="md:hidden text-xs font-bold text-slate-400 mb-1">التقدم</span>
                        <span className="text-sm text-slate-600">{item.progress}%</span>
                      </div>
                    </td>
                    <td className="md:table-cell md:px-4 md:py-4">
                      <div className="flex flex-col md:block">
                        <span className="md:hidden text-xs font-bold text-slate-400 mb-1">الأولوية</span>
                        <span className="text-sm text-slate-600">{item.urgency}</span>
                      </div>
                    </td>
                    <td className="md:table-cell md:px-4 md:py-4">
                      <div className="flex flex-col md:block">
                        <span className="md:hidden text-xs font-bold text-slate-400 mb-1">الموعد</span>
                        <span className="text-sm text-slate-600">{item.deadline}</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-right">
            <h3 className="text-base font-bold text-brand-dark">تفاصيل القضية</h3>
            <p className="text-xs text-slate-500">ملخص سريع لما يحتاجه المستخدم الآن.</p>
          </div>
          <div className="mt-4 space-y-3">
            {selectedCase ? (
              <>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-sm font-bold text-brand-dark">{selectedCase.title}</p>
                  <p className="mt-1 text-xs text-slate-500">{selectedCase.subtitle}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">الخطوة التالية</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedCase.nextStep}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">المحامي</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedCase.lawyer}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] text-slate-400">الموعد أو المهلة</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">{selectedCase.deadline}</p>
                </div>
              </>
            ) : (
              <p className="py-4 text-center text-xs text-slate-400 font-bold italic">لا يوجد ملف مختار...</p>
            )}
          </div>
        </section>
      </aside>
    </div>
  );

  const renderServices = () => (
    <div className="space-y-6">
      <NoticePanel
        title="كيف تبدأ؟"
        description="اختر نوع الخدمة أولاً، ثم راجع المحامين المقترحين أسفل الصفحة، وبعدها احجز الموعد أو ارفع المتطلبات لبدء الإجراء."
      />
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="text-right">
          <h3 className="text-2xl font-black text-brand-dark">الخدمات القانونية المتاحة</h3>
          <p className="mt-1 text-sm font-bold text-slate-500">اختر الخدمة المطلوبة لبدء إجراءاتك القانونية بشكل رقمي كامل.</p>
        </div>
        <div className="flex flex-row-reverse flex-wrap gap-2">
          {serviceCategories.map((cat) => (
            <button
              key={cat}
              onClick={() => setServiceCategory(cat)}
              className={`rounded-full px-4 py-2 text-xs font-black transition-all ${serviceCategory === cat
                ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20'
                : 'bg-white text-slate-500 border border-slate-200 hover:border-brand-gold hover:text-brand-navy'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {filteredServices.map((service) => (
          <button
            key={service.id}
            className="group flex flex-col rounded-[2.5rem] border border-slate-200 bg-white p-6 text-right transition-all hover:border-brand-gold hover:shadow-premium"
          >
            <div className={`mb-6 flex h-14 w-14 items-center justify-center rounded-3xl bg-slate-50 text-brand-navy shadow-sm transition-all group-hover:bg-brand-navy group-hover:text-white group-hover:scale-110`}>
              <i className={`${service.icon} text-2xl`}></i>
            </div>
            <h4 className="text-lg font-black text-brand-dark group-hover:text-brand-navy">{service.title}</h4>
            <p className="mt-2 flex-1 text-xs font-bold leading-6 text-slate-500">{service.description}</p>
            <div className="mt-6 flex flex-col gap-2 border-t border-slate-100 pt-4">
              <div className="flex flex-row-reverse items-center justify-between text-[11px] font-black">
                <span className="text-slate-400">التكلفة:</span>
                <span className="text-brand-navy">{service.price}</span>
              </div>
              <div className="flex flex-row-reverse items-center justify-between text-[11px] font-black">
                <span className="text-slate-400">المدة:</span>
                <span className="text-slate-600">{service.time}</span>
              </div>
            </div>
          </button>
        ))}
      </div>
      {filteredServices.length === 0 && (
        <div className="py-20 text-center text-slate-400">
          <i className="fa-solid fa-magnifying-glass mb-4 block text-4xl opacity-20"></i>
          <p className="text-lg font-black">لا توجد خدمات متاحة في هذا التصنيف حالياً.</p>
        </div>
      )}

      {renderLawyerFinder()}
    </div>
  );

  const renderAssist = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-right">
            <h3 className="text-lg font-bold text-brand-dark">المساعد القانوني الذكي</h3>
            <p className="text-sm text-slate-500">الطريقة الأسرع لفهم القضية، مراجعة النصوص، أو طرح الأسئلة.</p>
          </div>
          <span className="rounded-full bg-brand-gold/15 px-3 py-1 text-xs font-bold text-brand-dark">Beta</span>
        </div>

        <div className="mt-4 rounded-[28px] grad-ai p-5 text-white shadow-premium">
          <div className="flex items-start gap-4">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-dark/70 text-brand-gold">
              <i className="fa-solid fa-brain text-3xl"></i>
            </div>
            <div className="min-w-0 flex-1 text-right">
              <h4 className="text-xl font-bold">اسأل عن قضيتك مباشرة</h4>
              <p className="mt-1 text-sm leading-6 text-blue-100">
                يمكنك فتح AI Chat لطلب شرح مبسط، تلخيص مستند، أو معرفة الخطوة التالية في القضية المختارة.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/aichat')}
                  className="rounded-xl bg-white px-4 py-2 text-sm font-bold text-brand-dark transition hover:bg-slate-100"
                >
                  فتح AI Chat
                </button>
                <button
                  type="button"
                  onClick={() => setSosOpen(true)}
                  className="rounded-xl border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  استشارة عاجلة
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {[
            'ما هي الخطوة التالية في عقد الإيجار التجاري؟',
            'لخص لي ملاحظات العلامة التجارية بلغة بسيطة',
            'ما المستندات الناقصة في المطالبة المالية؟',
            'هل يوجد موعد قريب يحتاج حضوري؟',
          ].map((prompt) => (
            <button
              key={prompt}
              type="button"
              onClick={() => navigate('/aichat')}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 text-right text-sm text-slate-700 transition hover:border-brand-navy hover:bg-white"
            >
              {prompt}
            </button>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-brand-dark">اختصارات مفيدة</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] text-slate-400">القضية الحالية</p>
              <p className="mt-1 text-sm font-semibold text-brand-dark">
                {selectedCase ? selectedCase.title : 'لا يوجد ملف مختار'}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] text-slate-400">أفضل سؤال الآن</p>
              <p className="mt-1 text-sm font-semibold text-brand-dark">ما الذي يجب أن أرسله اليوم؟</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );

  const renderDocuments = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1.1fr)_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <h3 className="text-lg font-bold text-brand-dark">المستندات</h3>
            <p className="text-sm text-slate-500">رفع الملفات، تتبع المطلوب، ومعرفة حالة كل مستند.</p>
          </div>
          <button className="rounded-xl bg-brand-navy px-4 py-2 text-sm font-bold text-white transition hover:bg-brand-dark">
            رفع مستند
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-4 text-right">
            <p className="text-[11px] font-bold text-red-500">مستندات مطلوبة</p>
            <p className="mt-1 text-2xl font-black text-red-700">{requiredDocuments.length}</p>
            <p className="mt-1 text-xs text-red-600">كل مستند مطلوب هنا يؤخر التقدم حتى يتم رفعه.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-right">
            <p className="text-[11px] font-bold text-slate-400">آخر متابعة</p>
            <p className="mt-1 text-sm font-black text-brand-dark">
              {nextActionCase ? nextActionCase.title : 'لا توجد قضايا جارية'}
            </p>
            {nextActionCase && (
              <p className="mt-1 text-xs text-slate-500">{nextActionCase.nextStep}</p>
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3">
          {documents.map((doc) => (
            <article key={doc.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${doc.status === 'مطلوب' ? 'bg-red-50 text-red-700' : doc.status === 'مكتمل' ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'}`}>
                  {doc.status}
                </span>
                <div className="min-w-0 text-right">
                  <p className="truncate text-sm font-bold text-brand-dark">{doc.name}</p>
                  <p className="mt-1 text-xs text-slate-500">{doc.caseName}</p>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                <span>{doc.updatedAt}</span>
                <span>{doc.type}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-brand-dark">مطلوب منك</h3>
          <div className="mt-4 space-y-3">
            {documents.filter((doc) => doc.status === 'مطلوب').map((doc) => (
              <div key={doc.id} className="rounded-2xl bg-red-50 px-4 py-3 text-right">
                <p className="text-sm font-semibold text-red-700">{doc.name}</p>
                <p className="mt-1 text-xs text-red-600">{doc.caseName}</p>
              </div>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );

  const renderSchedule = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="text-right">
          <h3 className="text-lg font-bold text-brand-dark">المواعيد والتذكيرات</h3>
          <p className="text-sm text-slate-500">كل ما هو قادم خلال الأيام القادمة في عرض واحد.</p>
        </div>
        <div className="relative mt-8 space-y-6 before:absolute before:right-5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-100">
          {schedule.map((item) => (
            <article key={item.id} className="relative pr-12">
              <div className="absolute right-3 top-1 z-10 h-4 w-4 rounded-full border-4 border-white bg-brand-gold shadow-sm"></div>
              <div className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-md">
                <div className="flex items-center justify-between gap-3 mb-2">
                  <span className="rounded-full bg-white border border-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500 uppercase">{item.type}</span>
                  <span className="text-xs font-bold text-brand-navy">{item.time}</span>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-dark">{item.title}</p>
                  <p className="mt-1 text-xs text-slate-500 leading-relaxed">مرتبط بـ: {item.caseName}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-brand-dark">القادم خلال 7 أيام</h3>
          <div className="mt-4 grid gap-3">
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] text-slate-400">المواعيد</p>
              <p className="mt-1 text-xl font-bold text-brand-dark">3</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right">
              <p className="text-[11px] text-slate-400">تذكيرات هامة</p>
              <p className="mt-1 text-xl font-bold text-brand-dark">2</p>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );

  const renderPayments = () => (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="text-right">
            <h3 className="text-lg font-bold text-brand-dark">المدفوعات والمحفظة</h3>
            <p className="text-sm text-slate-500">رصيد واضح، سجل مصروفات، وفواتير قابلة للمتابعة.</p>
          </div>
          <i className="fa-solid fa-shield-halved text-green-500" title="دفع آمن"></i>
        </div>

        <div className="mt-4 rounded-[28px] grad-navy p-5 text-right text-white shadow-premium">
          <p className="text-sm text-blue-200">الرصيد المتاح</p>
          <h4 className="mt-2 text-4xl font-bold tracking-wide">
            {availableBalance.toLocaleString('ar-IQ')} <span className="text-sm text-brand-gold">IQD</span>
          </h4>
          <p className="mt-2 text-xs text-blue-100">يتم جلب الرصيد مباشرة من حسابك الحالي.</p>
        </div>

        <div className="mt-4 grid gap-3">
          {payments.map((item) => (
            <div key={item.id} className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <span className={`rounded-full px-2 py-1 text-[11px] font-semibold ${item.status === 'مدفوع' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'}`}>
                  {item.status}
                </span>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-dark">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500">{item.date}</p>
                </div>
              </div>
              <p className="mt-3 text-right text-sm font-semibold text-brand-dark">{item.amount}</p>
            </div>
          ))}
        </div>
      </section>

      <aside className="space-y-4">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-base font-bold text-brand-dark">طرق الدفع</h3>
          <div className="mt-4 grid gap-3">
            <button className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center transition hover:border-brand-gold hover:bg-white">
              <i className="fa-solid fa-mobile-screen text-2xl text-green-600"></i>
              <p className="mt-2 text-sm font-bold text-brand-dark">زين كاش</p>
            </button>
            <button className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-center transition hover:border-brand-gold hover:bg-white">
              <i className="fa-regular fa-credit-card text-2xl text-orange-500"></i>
              <p className="mt-2 text-sm font-bold text-brand-dark">كي كارد / ماستر</p>
            </button>
          </div>
        </section>
      </aside>
    </div>
  );

  return (
    <div className="app-view fade-in w-full max-w-full overflow-x-hidden">
      {/* Proactive Notification Banner */}
      <div className="mb-5 flex items-center justify-between rounded-2xl bg-brand-navy/95 backdrop-blur-md p-4 text-white shadow-lg shadow-brand-navy/20 animate-in slide-in-from-top duration-500 border border-white/10">
        <div className="flex items-center gap-3 min-w-0 relative"> {/* Added relative for dropdown positioning */}
          <NotificationBell /> {/* Use the NotificationBell component from context */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/10 border border-white/10">
            <i className="fa-solid fa-wallet text-brand-gold text-xs"></i>
            <span className="text-xs font-black">{availableBalance.toLocaleString('ar-IQ')} د.ع</span>
          </div>
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

            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10">
            <i className="fa-solid fa-sparkles text-brand-gold"></i>
          </div>
          <p className="text-xs font-black md:text-sm">نصيحة AI: بناءً على المسودة المرفوعة، ينصح بمراجعة بند "الصيانة التشغيلية" مع المحامي قبل انتهاء المهلة غداً.</p>
        </div>
        <button className="h-8 w-8 flex items-center justify-center rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition"><i className="fa-solid fa-xmark"></i></button>
      </div>

      <div className="rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_70px_-40px_rgba(15,23,42,0.45)] overflow-hidden">
        <div className="border-b border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f8fafc_52%,#eef2ff_100%)] px-4 py-5 sm:px-6">
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,440px)] xl:items-start">
            <div className="space-y-4 text-right min-w-0">
              <div className="flex flex-wrap items-center justify-end gap-2">
                <span className="inline-flex items-center rounded-full border border-brand-gold/20 bg-white/85 px-3 py-1 text-[11px] font-bold text-brand-navy">
                  <i className={`${activeTabMeta.icon} ml-2`}></i>
                  {activeTabMeta.label}
                </span>
                <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-500">
                  آخر مزامنة: الآن
                </span>
              </div>

              <div>
                <h1 className="text-3xl font-black leading-tight text-brand-dark sm:text-[34px]">
                  {greeting}، {user?.name?.split(' ')[0] || 'أحمد'}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
                  {activeTab === 'overview'
                    ? 'لوحة استخدام يومي مصممة لتقليل التشتت: راقب القضايا، اعرف ما يتطلب إجراءً منك، وانتقل بسرعة بين المستندات والمواعيد والمدفوعات.'
                    : `أنت الآن داخل قسم ${activeTabMeta.label}. ${activeTabMeta.description} مع عرض مهيأ للاستخدام المكثف والوصول الأسرع إلى الإجراءات المهمة.`}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {stats.map((stat, idx) => (
                  <motion.button
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    whileHover={{ y: -4, boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)" }}
                    onClick={() => handleStatClick(stat.label)}
                    className={`group relative overflow-hidden rounded-2xl border border-slate-200 bg-white/90 px-4 py-4 text-right shadow-sm transition-all hover:border-brand-navy/30 ${isInitialLoading ? 'animate-pulse opacity-50' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <i className={`${stat.icon} ${stat.tone} opacity-50 group-hover:opacity-100 transition-opacity`}></i>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">{stat.label}</p>
                    </div>
                    <p className="mt-2 text-3xl font-black text-brand-dark">{stat.value}</p>
                    <div className="mt-4 h-1 w-full overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full transition-all duration-1000 ${stat.color}`} style={{ width: isInitialLoading ? '0%' : `${stat.progress}%` }}></div>
                    </div>
                    <p className="mt-2 text-[11px] font-bold leading-5 text-slate-500 group-hover:text-brand-navy transition-colors">{stat.note}</p>
                  </motion.button>
                ))}
              </div>
            </div>
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-4 shadow-sm min-w-0">
              <div className="flex flex-col gap-4">
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-dark">إجراءات وفلاتر سريعة</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    اختصر الوصول للأعمال اليومية عبر إجراءات مباشرة وفلاتر عرض خفيفة.
                  </p>
                </div>

                <div className="flex justify-end mt-4 lg:mt-0">
                  <button
                    onClick={() => setIsCommandPaletteOpen(true)}
                    className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400 transition hover:border-brand-navy hover:text-brand-navy"
                  >
                    <span>البحث السريع (Ctrl+K)</span>
                    <i className="fa-solid fa-magnifying-glass"></i>
                  </button>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-right">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">الفترة</span>
                    <div className="relative">
                      <select
                        value={headerRange}
                        onChange={(event) => setHeaderRange(event.target.value as HeaderRange)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-navy"
                      >
                        {HEADER_RANGE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <i className="fa-solid fa-chevron-down pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                    </div>
                  </label>

                  <label className="text-right">
                    <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">التركيز</span>
                    <div className="relative">
                      <select
                        value={headerFocus}
                        onChange={(event) => setHeaderFocus(event.target.value as HeaderFocus)}
                        className="w-full appearance-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 pr-4 text-sm font-semibold text-slate-700 outline-none transition focus:border-brand-navy"
                      >
                        {HEADER_FOCUS_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                      <i className="fa-solid fa-chevron-down pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-xs text-slate-400"></i>
                    </div>
                  </label>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-end">
                  <button
                    type="button"
                    onClick={() => navigate('/aichat')}
                    className="inline-flex items-center justify-center rounded-xl bg-brand-navy px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-dark"
                  >
                    <i className="fa-solid fa-sparkles ml-2"></i>
                    فتح AI Chat
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveTab('documents')}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-brand-navy hover:text-brand-navy"
                  >
                    <i className="fa-solid fa-upload ml-2"></i>
                    رفع مستند
                  </button>
                  <button
                    type="button"
                    onClick={() => setSosOpen(true)}
                    className="inline-flex items-center justify-center rounded-xl bg-brand-gold px-4 py-3 text-sm font-bold text-brand-dark transition hover:bg-yellow-600"
                  >
                    <i className="fa-solid fa-bolt ml-2"></i>
                    استشارة عاجلة
                  </button>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">السياق الحالي</p>
                  <p className="mt-1 text-sm font-semibold text-brand-dark">
                    {headerRange === 'today' ? 'عرض اليوم' : headerRange === 'week' ? 'عرض آخر 7 أيام' : 'عرض هذا الشهر'}
                    {' • '}
                    {headerFocus === 'all' ? 'كل الأنشطة' : headerFocus === 'urgent' ? 'الأولوية العالية' : 'العناصر التي تنتظر إجراءك'}
                  </p>
                </div>
              </div>
            </div>
          </div >
        </div >

        <div className="border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1 overflow-x-auto no-scrollbar p-1 bg-slate-50/80 rounded-3xl" role="tablist" aria-label="أقسام لوحة المستخدم">
            {DASHBOARD_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                id={`dashboard-tab-${tab.id}`}
                aria-controls={`dashboard-panel-${tab.id}`}
                onClick={() => setActiveTab(tab.id)}
                className={`group relative flex min-w-[120px] md:min-w-[150px] items-center gap-3 rounded-[1.25rem] px-5 py-3 text-right transition-all duration-300 focus:outline-none ${
                  activeTab === tab.id ? 'text-white' : 'text-slate-500 hover:text-brand-navy'
                }`}
              >
                {activeTab === tab.id && (
                  <motion.div
                    layoutId="activeUserDashboardTab"
                    className="absolute inset-0 z-0 rounded-[1.25rem] bg-brand-navy shadow-lg shadow-brand-navy/20"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                  />
                )}
                <div className={`relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
                  activeTab === tab.id ? 'bg-white/15' : 'bg-white shadow-sm border border-slate-100 group-hover:border-brand-navy/30'
                }`}>
                  <i className={`${tab.icon} text-xs ${activeTab === tab.id ? 'text-white' : 'text-brand-navy'}`}></i>
                </div>
                <div className="relative z-10 min-w-0">
                  <p className="text-sm font-bold whitespace-nowrap">{tab.label}</p>
                  <p className={`truncate text-[10px] font-bold ${activeTab === tab.id ? 'text-white/70' : 'text-slate-400'}`}>
                    {tab.description}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-[760px] bg-slate-50/60 px-4 py-4 sm:px-6">
          {activeTab === 'overview' && (
            <div id="dashboard-panel-overview" role="tabpanel" aria-labelledby="dashboard-tab-overview">
              {renderOverview()}
            </div>
          )}
          {activeTab === 'services' && (
            <div id="dashboard-panel-services" role="tabpanel" aria-labelledby="dashboard-tab-services">
              {renderServices()}
            </div>
          )}
          {activeTab === 'cases' && (
            <div id="dashboard-panel-cases" role="tabpanel" aria-labelledby="dashboard-tab-cases">
              {renderCases()}
            </div>
          )}
          {activeTab === 'assist' && (
            <div id="dashboard-panel-assist" role="tabpanel" aria-labelledby="dashboard-tab-assist">
              {renderAssist()}
            </div>
          )}
          {activeTab === 'documents' && (
            <div id="dashboard-panel-documents" role="tabpanel" aria-labelledby="dashboard-tab-documents">
              {renderDocuments()}
            </div>
          )}
          {activeTab === 'schedule' && (
            <div id="dashboard-panel-schedule" role="tabpanel" aria-labelledby="dashboard-tab-schedule">
              {renderSchedule()}
            </div>
          )}
          {activeTab === 'payments' && (
            <div id="dashboard-panel-payments" role="tabpanel" aria-labelledby="dashboard-tab-payments">
              {renderPayments()}
            </div>
          )}
        </div>
      </div >

      {/* Command Palette Modal */}
      <AnimatePresence>
        {
          isCommandPaletteOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-start justify-center bg-brand-dark/20 px-4 pt-[15vh] backdrop-blur-sm"
              onClick={() => setIsCommandPaletteOpen(false)}
            >
              <motion.div
                initial={{ scale: 0.95, y: 10 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 10 }}
                className="w-full max-w-2xl overflow-hidden rounded-[2.5rem] border border-white/20 bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="relative border-b border-slate-100 p-6">
                  <i className="fa-solid fa-magnifying-glass absolute right-8 top-1/2 -translate-y-1/2 text-slate-400"></i>
                  <input
                    autoFocus
                    placeholder="ابحث عن ملف، موعد، أو إجراء..."
                    className="w-full bg-transparent pr-12 text-lg font-bold text-brand-dark outline-none placeholder:text-slate-300 text-right"
                    value={commandQuery}
                    onChange={(e) => setCommandQuery(e.target.value)}
                  />
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-4">
                  {commandResults.length > 0 ? (
                    <div className="space-y-2">
                      <p className="mb-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">النتائج</p>
                      {commandResults.map((res) => (
                        <button
                          key={res.id}
                          onClick={res.action}
                          className="flex w-full items-center justify-between rounded-2xl p-4 text-right transition hover:bg-slate-50"
                        >
                          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[10px] font-bold text-slate-500">{res.type}</span>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-sm font-bold text-brand-dark">{res.title}</p>
                              <p className="text-[11px] text-slate-400">{res.subtitle}</p>
                            </div>
                            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy">
                              <i className={`fa-solid ${res.icon}`}></i>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-slate-400">
                      <i className="fa-solid fa-terminal mb-3 block text-3xl opacity-20"></i>
                      <p className="text-sm font-bold">{commandQuery ? 'لا توجد نتائج تطابق بحثك' : 'ابدأ الكتابة للبحث السريع...'}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )
        }
      </AnimatePresence >

      {/* NotificationToast is now rendered globally by NotificationProvider, removed local toast */}
      {/* Compare Floating Bar */}
    </div >
  );
}
