import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';
import GlobalIntelligencePanel from './GlobalIntelligencePanel';
import { useTrackEvent, useUserIntelligence } from '../hooks/useIntelligence';
import apiClient from '../api/client';

const routePreloaders: Record<string, () => Promise<unknown>> = {
  '/user': () => import('../pages/UserDashboard'),
  '/cases': () => import('../pages/MyCases'),
  '/lawyers': () => import('../pages/Lawyers'),
  '/messages': () => import('../pages/Messages'),
  '/billing': () => import('../pages/Billing'),
  '/contracts': () => import('../pages/ContractWizard'),
  '/contract': () => import('../pages/ContractWizard'),
  '/action-plan': () => import('../pages/LegalActionPlan'),
  '/support': () => import('../pages/Support'),
  '/aichat': () => import('../pages/AiChat'),
  '/legal': () => import('../pages/LegalDocs'),
  '/following': () => import('../pages/Following'),
  '/feed': () => import('../pages/Feed'),
  '/pro': () => import('../pages/ProDashboard'),
  '/case-store': () => import('../pages/CaseStore'),
  '/admin': () => import('../pages/AdminDashboard'),
  '/settings': () => import('../pages/Settings'),
};

const routeDataPreloaders: Record<string, () => Promise<unknown>> = {
  '/user': () => apiClient.getDashboard(),
  '/cases': () => apiClient.getWorkspaceCases(),
  '/messages': () => apiClient.getWorkspaceCases(),
  '/lawyers': () => apiClient.getLawyers(),
  '/billing': () => apiClient.getDashboard(),
  '/contracts': () => Promise.all([apiClient.getContractTemplates(), apiClient.getUserContracts()]),
  '/contract': () => Promise.all([apiClient.getContractTemplates(), apiClient.getUserContracts()]),
  '/feed': () => Promise.all([apiClient.getFeedPosts('all', { limit: 10, offset: 0 }), apiClient.getFeedStories('active')]),
  '/following': () => Promise.all([apiClient.getFollowing(), apiClient.getLawyers()]),
  '/settings': () => apiClient.getSettings(),
  '/pro': () => apiClient.getProWorkspace(),
  '/case-store': () => apiClient.getLawyerCaseMarketplaceListings(),
  '/admin': () => Promise.all([apiClient.getAdminMetrics(), apiClient.getAdminIntelligence()]),
};

type CommandResult = {
  id: string;
  type: string;
  title: string;
  subtitle: string;
  icon: string;
  path?: string;
  aiBrief?: string;
};

type RouteMemory = Record<string, { count: number; lastSeen: number }>;
type RouteLearning = {
  routes: RouteMemory;
  transitions: Record<string, RouteMemory>;
};

type NavItem = {
  name: string;
  icon: string;
  path: string;
  visible?: boolean;
};

const isProfessionalRole = (role?: string | null) => role === 'pro' || role === 'lawyer';

const ROUTE_MEMORY_KEY = 'qistas_route_memory_v2';

const normalizeCommandText = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\u064B-\u0652]/g, '')
    .replace(/[إأآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/[^\p{Letter}\p{Number}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const commandAliases: Record<string, string[]> = {
  '/user': ['dashboard', 'home', 'الرئيسيه', 'لوحه', 'لوحتي', 'بدايه'],
  '/cases': ['case', 'cases', 'mycases', 'قضيه', 'قضايا', 'ملف', 'ملفاتي', 'متابعه'],
  '/lawyers': ['lawyer', 'lawyers', 'محامي', 'محامون', 'استشاره', 'ابحث'],
  '/contracts': ['contract', 'contracts', 'عقد', 'عقود', 'صياغه', 'انشاء عقد'],
  '/action-plan': ['plan', 'action', 'خطه', 'خطتي', 'مشكلتي', 'اجراء'],
  '/messages': ['message', 'messages', 'chat', 'رساله', 'رسائل', 'محادثه', 'محادثات'],
  '/feed': ['feed', 'community', 'مجتمع', 'تواصل', 'منشورات'],
  '/legal': ['legal', 'docs', 'library', 'law', 'مكتبه', 'قانون', 'قوانين', 'مواد'],
  '/aichat': ['ai', 'chatgpt', 'assistant', 'مساعد', 'ذكاء', 'اسال', 'حلل'],
  '/billing': ['billing', 'wallet', 'pay', 'دفع', 'مدفوعات', 'رصيد', 'محفظه', 'فاتوره'],
  '/settings': ['settings', 'اعدادات', 'حساب', 'امان', 'خصوصيه'],
  '/following': ['saved', 'follow', 'محفوظ', 'المحفوظون', 'متابعه المحامين'],
  '/pro': ['office', 'pro', 'مكتب', 'مكتبي', 'محامي'],
  '/case-store': ['store', 'opportunities', 'فرص', 'سوق', 'قضايا متاحه'],
  '/admin': ['admin', 'اداره', 'تحكم', 'نظام'],
};

const pageInsights: Record<string, { title: string; summary: string; icon: string; prompt: string; primaryPath?: string; primaryLabel?: string }> = {
  '/user': {
    title: 'موجز يومك القانوني',
    summary: 'رتب الملفات والتنبيهات والرصيد في خطوة واحدة.',
    icon: 'fa-table-columns',
    prompt: 'حلل لوحة التحكم الخاصة بي واقترح أهم ثلاث خطوات قانونية أو تشغيلية لهذا اليوم.',
  },
  '/cases': {
    title: 'قائد الملفات الذكي',
    summary: 'راجع الرسائل والوثائق والإغلاق قبل أن تضيع أي متابعة.',
    icon: 'fa-folder-open',
    prompt: 'حلل ملفات القضايا الحالية وحدد ما يحتاج رداً أو وثيقة أو إغلاقاً أو دفعاً.',
  },
  '/lawyers': {
    title: 'مطابقة محامي أذكى',
    summary: 'حوّل حاجتك القانونية إلى معايير اختيار واضحة.',
    icon: 'fa-scale-balanced',
    prompt: 'ساعدني في اختيار محام مناسب حسب نوع القضية والمدينة والميزانية والأسئلة التي يجب طرحها قبل الاستشارة.',
  },
  '/messages': {
    title: 'موجز المحادثات',
    summary: 'استخرج الردود المهمة ونقاط المتابعة من الرسائل.',
    icon: 'fa-comments',
    prompt: 'لخص لي المحادثات القانونية الحالية وحدد الرسائل التي تحتاج رداً سريعاً مع صياغة رد مناسبة.',
  },
  '/billing': {
    title: 'مراقب المدفوعات',
    summary: 'افهم الرصيد والفواتير والدفعات المتأخرة قبل التصعيد.',
    icon: 'fa-wallet',
    prompt: 'حلل وضع المدفوعات والرصيد والفواتير واقترح أفضل خطوة مالية قانونية تالية.',
  },
  '/contracts': {
    title: 'مراجع العقود الذكي',
    summary: 'جهز شروط العقد ومخاطر التوقيع قبل الإنشاء أو الإرسال.',
    icon: 'fa-file-contract',
    prompt: 'ساعدني على إنشاء أو مراجعة عقد واضح: ما الشروط الأساسية، المخاطر، والمستندات المطلوبة؟',
  },
  '/action-plan': {
    title: 'مخطط الإجراءات',
    summary: 'حوّل المشكلة إلى خطوات قانونية قابلة للتنفيذ.',
    icon: 'fa-route',
    prompt: 'حوّل مشكلتي القانونية إلى خطة عمل مرتبة حسب الأولوية: مستندات، مواعيد، رسائل، ومخاطر.',
  },
  '/legal': {
    title: 'باحث قانوني مرافق',
    summary: 'اسأل عن المادة أو الإجراء واحصل على ملخص عملي.',
    icon: 'fa-book-open',
    prompt: 'ساعدني في البحث داخل المكتبة القانونية العراقية: ما النصوص الأقرب وما الإجراء العملي المرتبط بها؟',
  },
  '/feed': {
    title: 'فلتر المعرفة',
    summary: 'حوّل المنشورات القانونية إلى مواضيع متابعة مفيدة.',
    icon: 'fa-users-rectangle',
    prompt: 'استخرج من نشاط المجتمع القانوني أهم موضوعات المتابعة والأسئلة التي تستحق البحث أو الاستشارة.',
  },
  '/settings': {
    title: 'تحسين الحساب',
    summary: 'أكمل البيانات التي ترفع الثقة ودقة التوصيات.',
    icon: 'fa-user-gear',
    prompt: 'راجع إعدادات حسابي واقترح ما يجب إكماله لتحسين الثقة والأمان ودقة التوصيات.',
  },
  '/pro': {
    title: 'مدير مكتب ذكي',
    summary: 'رتب العملاء والملفات والرسائل حسب الأولوية المهنية.',
    icon: 'fa-briefcase',
    prompt: 'حلل مكتب المحامي وحدد الملفات والعملاء والرسائل التي تحتاج متابعة اليوم.',
  },
  '/case-store': {
    title: 'صياد الفرص',
    summary: 'اختر القضايا الأعلى ملاءمة قبل تقديم عرض.',
    icon: 'fa-ranking-star',
    prompt: 'حلل فرص القضايا المتاحة واقترح أيها أنسب لي وكيف أصيغ عرضاً مهنياً.',
  },
  '/admin': {
    title: 'مراقب النظام',
    summary: 'راقب مؤشرات الإدارة والمخاطر التشغيلية سريعاً.',
    icon: 'fa-server',
    prompt: 'حلل لوحة الإدارة وحدد أهم مخاطر النظام والمستخدمين والإجراءات المطلوبة الآن.',
  },
};

const readRouteLearning = (): RouteLearning => {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(ROUTE_MEMORY_KEY) || '{}') as any;
    if (parsed && typeof parsed === 'object' && 'routes' in parsed && 'transitions' in parsed) {
      return parsed as RouteLearning;
    }
    return { routes: parsed as RouteMemory, transitions: {} };
  } catch {
    return { routes: {}, transitions: {} };
  }
};

const writeRouteLearning = (learning: RouteLearning) => {
  try {
    window.localStorage.setItem(ROUTE_MEMORY_KEY, JSON.stringify(learning));
  } catch {
    // Local personalization is optional.
  }
};

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const { NotificationBell, notifications, isNotificationsOpen, setIsNotificationsOpen, markAsRead, deleteNotification, clearAllNotifications } = useNotifications();
  const { data: intelligence } = useUserIntelligence();
  const { trackEvent: trackAppEvent } = useTrackEvent('app');
  const [systemSettings, setSystemSettings] = useState<{
    maintenanceMode: boolean;
    announcement: string;
    offlineMessage: string;
    supportEmail: string;
  } | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [moreNavOpen, setMoreNavOpen] = useState(false);
  const [intelligenceOpen, setIntelligenceOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'unread'>('unread');
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);
  const moreNavRef = useRef<HTMLDivElement | null>(null);
  const previousRouteRef = useRef<string | null>(null);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);
  const [routeLearning, setRouteLearning] = useState<RouteLearning>(() => (typeof window === 'undefined' ? { routes: {}, transitions: {} } : readRouteLearning()));
  const routeMemory = routeLearning.routes;

  const headerTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 360, damping: 34, mass: 0.8 };

  const menuTransition = prefersReducedMotion
    ? { duration: 0 }
    : { type: 'spring' as const, stiffness: 420, damping: 32, mass: 0.7 };

  // Breadcrumb mapping
  const pathMap: Record<string, string> = {
    'user': 'الرئيسية',
    'cases': 'القضايا',
    'lawyers': 'المحامون',
    'messages': 'الرسائل',
    'billing': 'المدفوعات',
    'following': 'المحفوظون',
    'feed': 'تواصل',
    'legal': 'المكتبة',
    'action-plan': 'خطتي القانونية',
    'aichat': 'المساعد',
    'pro': 'المكتب',
    'case-store': 'فرص المحامين',
    'admin': 'الإدارة',
    'profile': 'الملف',
    'settings': 'الإعدادات',
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!isNotificationsOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!notificationsMenuRef.current?.contains(event.target as Node)) {
        setIsNotificationsOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [isNotificationsOpen, setIsNotificationsOpen]);

  useEffect(() => {
    if (!moreNavOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!moreNavRef.current?.contains(event.target as Node)) {
        setMoreNavOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [moreNavOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setIsCommandPaletteOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    const baseTitle = 'القسطاس الذكي';
    const currentPath = location.pathname;

    // Find the most specific title from the pathMap
    let pageTitle = '';
    const segments = currentPath.split('/').filter(Boolean);

    if (segments.length > 0) {
      const lastSegment = segments[segments.length - 1];
      const parentSegment = segments.length > 1 ? segments[segments.length - 2] : null;

      if (pathMap[lastSegment]) {
        pageTitle = pathMap[lastSegment];
      } else if (parentSegment && (parentSegment === 'cases' || parentSegment === 'pro')) {
        // Handle dynamic IDs for cases/pro routes
        pageTitle = 'ملف القضية';
      } else if (parentSegment === 'profile') {
        pageTitle = 'الملف الشخصي';
      }
    }

    document.title = pageTitle ? `${baseTitle} | ${pageTitle}` : baseTitle;
  }, [location.pathname, pathMap]);

  const ownProfilePath = user?.id ? `/profile/${user.id}` : '/settings';
  const ownProfileLabel = isProfessionalRole(user?.role) ? 'ملفي العام' : 'الملف الشخصي';

  const prefetchRoute = (path?: string) => {
    if (!path) return;
    const loader = routePreloaders[path];
    if (loader) void loader();
    if (!apiClient.getToken()) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    if (connection?.saveData || connection?.effectiveType === '2g') return;
    const dataLoader = routeDataPreloaders[path];
    if (dataLoader) void dataLoader().catch(() => undefined);
  };

  const getKnownRoute = (path: string) =>
    Object.keys({ ...routePreloaders, ...pageInsights })
      .sort((left, right) => right.length - left.length)
      .find((route) => path === route || path.startsWith(`${route}/`));

  const currentPageInsight = useMemo(() => {
    const matchedPath = Object.keys(pageInsights)
      .sort((left, right) => right.length - left.length)
      .find((path) => location.pathname === path || location.pathname.startsWith(`${path}/`));
    return matchedPath ? pageInsights[matchedPath] : null;
  }, [location.pathname]);

  useEffect(() => {
    if (!user) return;
    const route = getKnownRoute(location.pathname);
    if (!route) return;

    setRouteLearning((current) => {
      const previousRoute = previousRouteRef.current;
      const next: RouteLearning = {
        routes: {
          ...current.routes,
          [route]: {
            count: Math.min(999, (current.routes[route]?.count || 0) + 1),
            lastSeen: Date.now(),
          },
        },
        transitions: { ...current.transitions },
      };

      if (previousRoute && previousRoute !== route) {
        next.transitions[previousRoute] = {
          ...(next.transitions[previousRoute] || {}),
          [route]: {
            count: Math.min(999, ((next.transitions[previousRoute] || {})[route]?.count || 0) + 1),
            lastSeen: Date.now(),
          },
        };
      }

      previousRouteRef.current = route;
      writeRouteLearning(next);
      return next;
    });
  }, [location.pathname, user]);
  const navItems = useMemo<NavItem[]>(
    () =>
      [
        { name: 'لوحتي', icon: 'fa-table-columns', path: '/user' },
        { name: 'ملفاتي', icon: 'fa-folder-open', path: '/cases' },
        { name: 'ابحث', icon: 'fa-scale-balanced', path: '/lawyers' },
        { name: 'أنشئ عقداً', icon: 'fa-file-contract', path: '/contracts' },
        { name: 'خطتي', icon: 'fa-route', path: '/action-plan' },
        { name: 'المحادثات', icon: 'fa-comments', path: '/messages' },
        { name: 'المجتمع', icon: 'fa-users-rectangle', path: '/feed' },
        { name: 'المكتبة', icon: 'fa-book-open', path: '/legal' },
        { name: 'المساعد', icon: 'fa-robot', path: '/aichat' },
        { name: 'المدفوعات', icon: 'fa-wallet', path: '/billing' },
        { name: 'مكتبي', icon: 'fa-briefcase', path: '/pro', visible: isProfessionalRole(user?.role) || user?.role === 'admin' },
        { name: 'فرص', icon: 'fa-ranking-star', path: '/case-store', visible: isProfessionalRole(user?.role) || user?.role === 'admin' },
        { name: 'تحكم', icon: 'fa-server', path: '/admin', visible: user?.role === 'admin' },
      ].filter((item) => item.visible !== false),
    [user?.role]
  );

  const commandNavItems = useMemo<CommandResult[]>(() => {
    const items: CommandResult[] = [
      { id: 'n1', type: 'ملاحة', title: 'الرئيسية', subtitle: 'أسرع طريق لما يحتاج انتباهك الآن', icon: 'fa-table-columns', path: '/user' },
      { id: 'n2', type: 'ملاحة', title: 'القضايا', subtitle: 'متابعة سير العمل والمهام المطلوبة', icon: 'fa-folder-open', path: '/cases' },
      { id: 'n3', type: 'ملاحة', title: 'المحامون', subtitle: 'ابحث وتواصل وافتح قضية بسرعة', icon: 'fa-scale-balanced', path: '/lawyers' },
      { id: 'n4', type: 'ملاحة', title: 'العقود', subtitle: 'إنشاء ومراجعة عقود البيع والشراء', icon: 'fa-file-contract', path: '/contracts' },
      { id: 'n4b', type: 'ملاحة', title: 'خطتي القانونية', subtitle: 'وصف المشكلة وتحويلها إلى خطوات عملية', icon: 'fa-route', path: '/action-plan' },
      { id: 'n5', type: 'ملاحة', title: 'الرسائل', subtitle: 'جميع المحادثات القانونية في مكان واحد', icon: 'fa-comments', path: '/messages' },
      { id: 'n6', type: 'ملاحة', title: 'تواصل', subtitle: 'منشورات وفيديوهات من المحامين الموثقين', icon: 'fa-users-rectangle', path: '/feed' },
      { id: 'n7', type: 'ملاحة', title: 'المكتبة', subtitle: 'مراجع ووثائق قانونية جاهزة للبحث', icon: 'fa-book-open', path: '/legal' },
      { id: 'n8', type: 'ملاحة', title: 'مستشارك الذكي', subtitle: 'اسأل واحصل على تلخيص وتحليل قانوني سريع', icon: 'fa-robot', path: '/aichat' },
      { id: 'n9', type: 'ملاحة', title: 'المدفوعات', subtitle: 'الرصيد والفواتير والمعاملات', icon: 'fa-wallet', path: '/billing' },
      { id: 'n10', type: 'ملاحة', title: 'ملفي الشخصي', subtitle: 'فتح بياناتك وصورتك ومعلومات حسابك', icon: 'fa-id-card', path: ownProfilePath },
      { id: 'n11', type: 'ملاحة', title: 'الإعدادات', subtitle: 'إدارة الحساب والأمان والتفضيلات', icon: 'fa-user-gear', path: '/settings' },
    ];

    if (user?.role === 'admin') {
      items.push({ id: 'a1', type: 'إدارة', title: 'الإدارة', subtitle: 'إدارة النظام والمستخدمين', icon: 'fa-server', path: '/admin' });
    }
    if (isProfessionalRole(user?.role)) {
      items.push({ id: 'p1', type: 'احترافي', title: 'المكتب', subtitle: 'إدارة القضايا والعملاء', icon: 'fa-briefcase', path: '/pro' });
      items.push({ id: 'p2', type: 'احترافي', title: 'فرص المحامين', subtitle: 'القضايا المرتبة حسب أفضل فرصة لك', icon: 'fa-ranking-star', path: '/case-store' });
    }
    if (user?.role === 'admin') {
      items.push({ id: 'p2a', type: 'احترافي', title: 'فرص المحامين', subtitle: 'القضايا المرتبة حسب أفضل فرصة لك', icon: 'fa-ranking-star', path: '/case-store' });
    }

    return items;
  }, [ownProfilePath, user?.role]);

  const learnedRouteCommands = useMemo<CommandResult[]>(() => {
    return commandNavItems
      .filter((item) => item.path && routeMemory[item.path])
      .sort((left, right) => {
        const leftMemory = routeMemory[left.path!];
        const rightMemory = routeMemory[right.path!];
        const leftScore = leftMemory.count * 10 + leftMemory.lastSeen / 100000000000;
        const rightScore = rightMemory.count * 10 + rightMemory.lastSeen / 100000000000;
        return rightScore - leftScore;
      })
      .slice(0, 4)
      .map((item) => ({
        ...item,
        id: `learned-${item.path}`,
        type: routeMemory[item.path!]?.count > 2 ? 'معتاد' : 'آخر زيارة',
        subtitle: routeMemory[item.path!]?.count > 2 ? 'صفحة تستخدمها كثيراً، تم تجهيزها مسبقاً' : item.subtitle,
      }));
  }, [commandNavItems, routeMemory]);

  const learnedNextRoute = useMemo(() => {
    const currentRoute = getKnownRoute(location.pathname);
    const transitionMatch = currentRoute
      ? navItems
          .filter((item) => item.path !== currentRoute && routeLearning.transitions[currentRoute]?.[item.path])
          .sort((left, right) => {
            const leftMemory = routeLearning.transitions[currentRoute]?.[left.path];
            const rightMemory = routeLearning.transitions[currentRoute]?.[right.path];
            const leftScore = (leftMemory?.count || 0) * 14 + (leftMemory?.lastSeen || 0) / 100000000000;
            const rightScore = (rightMemory?.count || 0) * 14 + (rightMemory?.lastSeen || 0) / 100000000000;
            return rightScore - leftScore;
          })[0]
      : null;

    if (transitionMatch) return transitionMatch;

    return navItems
      .filter((item) => item.path !== currentRoute && routeMemory[item.path])
      .sort((left, right) => {
        const leftMemory = routeMemory[left.path];
        const rightMemory = routeMemory[right.path];
        const leftScore = leftMemory.count * 8 + leftMemory.lastSeen / 100000000000;
        const rightScore = rightMemory.count * 8 + rightMemory.lastSeen / 100000000000;
        return rightScore - leftScore;
      })[0] || null;
  }, [location.pathname, navItems, routeLearning.transitions, routeMemory]);

  const commandResults = useMemo(() => {
    const rawQuery = commandQuery.trim();
    const query = normalizeCommandText(rawQuery);

    const smartItems: CommandResult[] = (intelligence?.recommendations || [])
      .filter((item: any) => item?.aiBrief)
      .slice(0, 4)
      .map((item: any) => ({
        id: `smart-${item.id}`,
        type: item.priority === 'high' ? 'أولوية عاجلة' : 'ذكاء',
        title: item.aiAction || item.title,
        subtitle: item.description || item.impact || 'تحليل ذكي حسب نشاطك الحالي',
        icon: item.icon || 'fa-wand-magic-sparkles',
        aiBrief: item.aiBrief,
      }));
    const pageActionItems: CommandResult[] = currentPageInsight
      ? [
          {
            id: 'page-analysis',
            type: 'الصفحة الحالية',
            title: `حلل: ${currentPageInsight.title}`,
            subtitle: currentPageInsight.summary,
            icon: currentPageInsight.icon,
            aiBrief: currentPageInsight.prompt,
          },
          ...(learnedNextRoute
            ? [{
                id: `continue-${learnedNextRoute.path}`,
                type: 'تنبؤ',
                title: `تابع إلى ${learnedNextRoute.name}`,
                subtitle: 'اقتراح مبني على مسار استخدامك السابق',
                icon: learnedNextRoute.icon,
                path: learnedNextRoute.path,
              }]
            : []),
        ]
      : [];

    if (!query) {
      const merged = [...smartItems, ...pageActionItems, ...learnedRouteCommands, ...commandNavItems];
      return merged.filter((item, index, list) => list.findIndex((entry) => entry.id === item.id || entry.path === item.path) === index).slice(0, 8);
    }

    const scoredItems = [...smartItems, ...pageActionItems, ...learnedRouteCommands, ...commandNavItems]
      .map((item) => {
        const haystack = normalizeCommandText(`${item.title} ${item.subtitle} ${item.type} ${(item.path && commandAliases[item.path]?.join(' ')) || ''}`);
        const tokens = query.split(' ').filter(Boolean);
        const exact = haystack.includes(query) ? 20 : 0;
        const tokenScore = tokens.reduce((score, token) => score + (haystack.includes(token) ? 5 : 0), 0);
        const smartBoost = item.aiBrief ? 4 : 0;
        return { item, score: exact + tokenScore + smartBoost };
      })
      .filter((entry) => entry.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((entry) => entry.item);

    const aiFallback: CommandResult = {
      id: 'ask-ai-query',
      type: 'ذكاء مباشر',
      title: `اسأل المساعد: ${rawQuery}`,
      subtitle: 'حوّل النص المكتوب إلى جلسة تحليل قانوني فورية',
      icon: 'fa-wand-magic-sparkles',
      aiBrief: rawQuery,
    };

    return [...scoredItems.slice(0, 7), aiFallback];
  }, [commandNavItems, commandQuery, currentPageInsight, intelligence?.recommendations, learnedNextRoute, learnedRouteCommands]);

  const executeCommand = (result: CommandResult) => {
    if (result.aiBrief) {
      navigate('/aichat', { state: { initialQuery: result.aiBrief } });
      prefetchRoute('/aichat');
    } else if (result.path) {
      navigate(result.path);
      prefetchRoute(result.path);
    }
    setCommandQuery('');
    setIsCommandPaletteOpen(false);
  };

  const runPageAnalysis = (prompt?: string) => {
    navigate('/aichat', {
      state: {
        initialQuery: prompt || currentPageInsight?.prompt || 'حلل الصفحة الحالية واقترح أفضل خطوة تالية.',
      },
    });
    prefetchRoute('/aichat');
  };

  const handleLogout = () => {
    if (!user) {
      navigate('/auth');
      return;
    }

    logout();
    navigate('/auth');
  };

  const handleLogin = () => {
    navigate('/auth');
    setIsProfileOpen(false);
    setMobileNavOpen(false);
  };

  const displayName = user?.name || 'زائر';
  const displayRole = user?.roleDescription || 'تصفح عام';
  const displayAvatar =
    user?.img ||
    user?.avatar ||
    `https://ui-avatars.com/api/?name=${encodeURIComponent(displayName)}&background=1B365D&color=ffffff&rounded=true`;

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const token = window.localStorage.getItem('auth_token') || window.localStorage.getItem('lexigate_token');
        const response = await fetch('/api/admin/system-settings', {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (!response.ok) return;
        setSystemSettings(await response.json());
      } catch {
        // keep default behavior
      }
    };

    fetchSettings();
  }, []);

  const filteredNotifications = useMemo(() => {
    return notificationsFilter === 'all'
      ? notifications
      : notifications.filter((notification) => !notification.read);
  }, [notifications, notificationsFilter]);

  const groupedNotifications = useMemo(() => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    const getGroupKey = (createdAt: string) => {
      const date = new Date(createdAt);
      const isToday = date.toDateString() === today.toDateString();
      const isYesterday = date.toDateString() === yesterday.toDateString();
      return isToday ? 'today' : isYesterday ? 'yesterday' : 'older';
    };

    const groups: Record<string, { label: string; items: typeof notifications }> = {
      today: { label: 'اليوم', items: [] },
      yesterday: { label: 'أمس', items: [] },
      older: { label: 'أقدم', items: [] }
    };

    [...filteredNotifications]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .forEach((notification) => {
        const key = getGroupKey(notification.createdAt);
        groups[key].items.push(notification);
      });

    return Object.values(groups).filter((group) => group.items.length > 0);
  }, [filteredNotifications]);

  useEffect(() => {
    setMobileNavOpen(false);
    setMoreNavOpen(false);
    setIntelligenceOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    trackAppEvent('route_changed', {
      path: location.pathname,
      previousPath: previousRouteRef.current,
    });
  }, [location.pathname, trackAppEvent]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', 'rtl');
    root.lang = 'ar';
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    window.localStorage.removeItem('app-theme');
  }, []);

  const primaryNavItems = useMemo(() => {
    const priorityPaths = ['/user', '/action-plan', '/cases', '/lawyers'];
    if (isProfessionalRole(user?.role) || user?.role === 'admin') {
      priorityPaths.push('/pro', '/case-store');
    }
    if (user?.role === 'admin') {
      priorityPaths.push('/admin');
    }

    learnedRouteCommands
      .map((item) => item.path)
      .filter(Boolean)
      .slice(0, 2)
      .forEach((path) => {
        if (path && !priorityPaths.includes(path)) priorityPaths.push(path);
      });

    return navItems.filter((item) => priorityPaths.includes(item.path));
  }, [learnedRouteCommands, navItems, user?.role]);
  const overflowNavItems = useMemo(
    () => navItems.filter((item) => !primaryNavItems.some((primaryItem) => primaryItem.path === item.path)),
    [navItems, primaryNavItems]
  );
  const isNavItemActive = (item: { path: string }) => location.pathname === item.path || (item.path !== '/user' && location.pathname.startsWith(item.path));
  const hasActiveOverflowItem = overflowNavItems.some(isNavItemActive);
  const pageRecommendation = useMemo(() => {
    const recommendations = intelligence?.recommendations || [];
    return (
      recommendations.find((item: any) => item?.target && (location.pathname === item.target || location.pathname.startsWith(`${item.target}/`))) ||
      recommendations[0] ||
      null
    );
  }, [intelligence?.recommendations, location.pathname]);
  const predictiveQuickAction = pageRecommendation?.quickAction || null;
  useEffect(() => {
    const learnedRoutes = learnedRouteCommands.map((item) => item.path).filter(Boolean) as string[];
    const warmRoutes = Array.from(new Set(['/aichat', ...primaryNavItems.slice(0, 4).map((item) => item.path), ...learnedRoutes]));
    const warm = () => warmRoutes.forEach(prefetchRoute);
    const hasIdleCallback = typeof window.requestIdleCallback === 'function';
    const idleId = hasIdleCallback
      ? window.requestIdleCallback(warm, { timeout: 2500 })
      : globalThis.setTimeout(warm, 1200);

    return () => {
      if (hasIdleCallback && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleId);
      } else {
        globalThis.clearTimeout(idleId);
      }
    };
  }, [learnedRouteCommands, primaryNavItems]);

  return (
    <div className="flex min-h-screen w-full flex-col">
      <motion.header
        initial={prefersReducedMotion ? false : { y: -18, opacity: 0 }}
        animate={{
          y: 0,
          opacity: 1,
          height: isScrolled ? 56 : 64,
          backgroundColor: isScrolled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.72)',
          boxShadow: isScrolled ? '0 18px 40px rgba(15, 23, 42, 0.08)' : '0 0 0 rgba(15, 23, 42, 0)',
        }}
        transition={headerTransition}
        className="sticky top-0 z-50 w-full overflow-visible border-b border-slate-200/60 backdrop-blur-xl"
      >
        <motion.div
          aria-hidden="true"
          style={{ scaleX: scrollYProgress }}
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[2px] origin-right bg-brand-gold/80"
        />
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Brand & Logo */}
          <div className="flex items-center gap-3 lg:w-64">
            <motion.div
              animate={{
                scale: isScrolled ? 0.9 : 1,
                borderRadius: isScrolled ? 12 : 14,
                rotate: isScrolled ? 0 : -2,
              }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.04, rotate: 2 }}
              transition={headerTransition}
              className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl bg-brand-navy text-brand-gold shadow-lg shadow-brand-navy/20"
            >
              <motion.span
                aria-hidden="true"
                animate={prefersReducedMotion ? undefined : { x: ['120%', '-120%'] }}
                transition={{ duration: 2.8, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
                className="absolute inset-y-0 w-1/2 skew-x-[-18deg] bg-white/10"
              />
              <motion.i
                animate={{ scale: isScrolled ? 0.9 : 1, rotate: isScrolled ? 0 : 4 }}
                transition={headerTransition}
                className={`fa-solid fa-scale-balanced relative z-10 ${isScrolled ? 'text-xs' : 'text-sm'}`}
              />
            </motion.div>
            <AnimatePresence initial={false}>
              {!isScrolled && (
                <motion.div
                  key="brand-copy"
                  initial={prefersReducedMotion ? false : { opacity: 0, x: 10, width: 0 }}
                  animate={{ opacity: 1, x: 0, width: 'auto' }}
                  exit={prefersReducedMotion ? { display: 'none' } : { opacity: 0, x: 8, width: 0 }}
                  transition={headerTransition}
                  className="hidden overflow-hidden whitespace-nowrap text-right sm:block"
                >
                  <p className="text-base font-black leading-none tracking-tight text-brand-navy">القسطاس</p>
                  <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Smart Legal Platform</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Center Navigation */}
          <motion.nav
            initial={prefersReducedMotion ? false : 'hidden'}
            animate="show"
            variants={{
              hidden: {},
              show: {
                transition: { staggerChildren: 0.035, delayChildren: 0.05 },
              },
            }}
            className="hidden h-full items-center gap-1 xl:flex"
          >
            {primaryNavItems.map((item) => {
              const isActive = isNavItemActive(item);
              return (
                <motion.div
                  key={item.path}
                  variants={{
                    hidden: { opacity: 0, y: -8 },
                    show: { opacity: 1, y: 0 },
                  }}
                  transition={menuTransition}
                  whileHover={prefersReducedMotion ? undefined : { y: -1 }}
                >
                  <Link
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    className={`group relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm font-bold transition-colors ${isActive
                      ? 'bg-brand-navy/5 text-brand-navy'
                      : 'text-slate-500 hover:text-brand-navy hover:bg-slate-50'
                      }`}
                  >
                    {isActive && (
                      <motion.span
                        layoutId="nav-active-bg"
                        transition={headerTransition}
                        className="absolute inset-0 rounded-xl bg-brand-navy/5"
                      />
                    )}
                    <motion.i
                      animate={{ scale: isActive ? 1.08 : 1, y: isActive ? -1 : 0 }}
                      transition={headerTransition}
                      className={`fa-solid ${item.icon} relative z-10 text-xs ${isActive ? 'text-brand-navy' : 'text-slate-300 group-hover:text-brand-navy'}`}
                    />
                    <span className="relative z-10 whitespace-nowrap">{item.name}</span>
                    {isActive && (
                      <motion.div
                        layoutId="nav-pill"
                        transition={headerTransition}
                        className="absolute inset-x-2 -bottom-3 h-1 rounded-t-full bg-brand-navy"
                      />
                    )}
                  </Link>
                </motion.div>
              );
            })}
            {overflowNavItems.length > 0 && (
              <div ref={moreNavRef} className="relative">
                <motion.button
                  type="button"
                  onClick={() => setMoreNavOpen((current) => !current)}
                  whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                  className={`group relative flex items-center gap-2 overflow-hidden rounded-xl px-3 py-2 text-sm font-bold transition-colors ${hasActiveOverflowItem || moreNavOpen
                    ? 'bg-brand-navy/5 text-brand-navy'
                    : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'
                    }`}
                  aria-expanded={moreNavOpen}
                  aria-label="فتح الخدمات الأخرى"
                >
                  <i className={`fa-solid fa-table-cells-large relative z-10 text-xs ${hasActiveOverflowItem || moreNavOpen ? 'text-brand-navy' : 'text-slate-300 group-hover:text-brand-navy'}`} />
                  <span className="relative z-10 whitespace-nowrap">الخدمات</span>
                  <i className={`fa-solid fa-chevron-down relative z-10 text-[10px] transition-transform ${moreNavOpen ? 'rotate-180' : ''}`} />
                  {hasActiveOverflowItem && (
                    <motion.div
                      layoutId="nav-pill-overflow"
                      transition={headerTransition}
                      className="absolute inset-x-2 -bottom-3 h-1 rounded-t-full bg-brand-navy"
                    />
                  )}
                </motion.button>

                <AnimatePresence>
                  {moreNavOpen && (
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 10, scale: 0.98, filter: 'blur(6px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98, filter: 'blur(6px)' }}
                      transition={menuTransition}
                      className="absolute left-0 top-full z-50 mt-3 w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 text-right shadow-2xl"
                    >
                      <div className="px-3 py-3">
                        <p className="text-xs font-black text-brand-navy">خدمات إضافية</p>
                        <p className="mt-1 text-[11px] font-bold text-slate-400">كل الخدمات متاحة بدون ازدحام الهيدر</p>
                      </div>
                      <div className="space-y-1">
                        {overflowNavItems.map((item) => {
                          const isActive = isNavItemActive(item);
                          return (
                            <Link
                              key={item.path}
                              to={item.path}
                              onMouseEnter={() => prefetchRoute(item.path)}
                              onFocus={() => prefetchRoute(item.path)}
                              onClick={() => setMoreNavOpen(false)}
                              className={`flex items-center justify-between gap-3 rounded-xl px-3 py-3 transition ${isActive ? 'bg-brand-navy text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-brand-navy'}`}
                            >
                              <i className={`fa-solid fa-chevron-left text-[10px] ${isActive ? 'text-white/60' : 'text-slate-300'}`} />
                              <span className="flex-1 text-sm font-black">{item.name}</span>
                              <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${isActive ? 'bg-white/15 text-brand-gold' : 'bg-slate-50 text-brand-navy'}`}>
                                <i className={`fa-solid ${item.icon} text-xs`} />
                              </span>
                            </Link>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.nav>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-2 lg:w-64">
            {user && (
              <motion.button
                onClick={() => setIntelligenceOpen(true)}
                whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
                animate={{ height: isScrolled ? 36 : 40, width: isScrolled ? 36 : 40 }}
                transition={headerTransition}
                className={`relative flex items-center justify-center rounded-xl border border-brand-navy/10 bg-brand-navy text-brand-gold shadow-lg shadow-brand-navy/15 transition-all hover:bg-brand-dark ${isScrolled ? 'h-9 w-9' : 'h-10 w-10'}`}
                title="مساعد الموقع الذكي"
                aria-label="فتح مساعد الموقع الذكي"
              >
                <i className="fa-solid fa-wand-magic-sparkles text-xs"></i>
                <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white"></span>
              </motion.button>
            )}
            <motion.button
              onClick={() => setIsCommandPaletteOpen(true)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.94 }}
              animate={{ height: isScrolled ? 36 : 40, width: isScrolled ? 36 : 40 }}
              transition={headerTransition}
              className={`flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-brand-navy hover:text-brand-navy hover:shadow-sm ${isScrolled ? 'h-9 w-9' : 'h-10 w-10'}`}
              title="البحث السريع (Ctrl+K)"
            >
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </motion.button>

            <div ref={notificationsMenuRef} className="relative">
              <NotificationBell />
              <AnimatePresence>
                {isNotificationsOpen && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 14, scale: 0.96, filter: 'blur(8px)' }}
                    animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                    exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96, filter: 'blur(8px)' }}
                    transition={menuTransition}
                    className="absolute left-0 top-full mt-3 w-80 overflow-hidden rounded-[2rem] border border-slate-200 bg-white text-right shadow-2xl z-50 origin-top-left"
                  >
                    <div className="flex items-center justify-between border-b border-slate-50 bg-slate-50/50 p-3 gap-2">
                      <div className="flex items-center gap-2">
                        <button onClick={clearAllNotifications} className="flex items-center gap-1.5 text-[10px] font-black text-slate-400 hover:text-red-500 transition-colors">
                          <i className="fa-solid fa-trash-can text-[9px]"></i>
                          مسح الكل
                        </button>
                        <div className="h-6 w-px bg-slate-100" />
                        <button onClick={() => setNotificationsFilter('unread')} className={`text-[10px] font-black px-2 py-1 rounded-xl ${notificationsFilter === 'unread' ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-50'}`}>غير المقروءة</button>
                        <button onClick={() => setNotificationsFilter('all')} className={`text-[10px] font-black px-2 py-1 rounded-xl ${notificationsFilter === 'all' ? 'bg-brand-navy text-white' : 'text-slate-500 hover:bg-slate-50'}`}>الكل</button>
                      </div>
                      <h4 className="text-xs font-black text-brand-dark">التنبيهات</h4>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                      {groupedNotifications.length > 0 ? (
                        groupedNotifications.map((group) => (
                          <div key={group.label} className="space-y-3 px-1 py-2">
                            <div className="rounded-2xl bg-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-[0.24em] text-slate-500">
                              {group.label}
                            </div>
                            <div className="space-y-2">
                              {group.items.map((n) => (
                                <div
                                  key={n.id}
                                  onClick={() => {
                                    markAsRead(n.id);
                                    if (n.link) navigate(n.link);
                                    setIsNotificationsOpen(false);
                                  }}
                                  className={`group/item cursor-pointer rounded-[1.75rem] border border-slate-100 p-4 transition hover:bg-slate-50 relative ${!n.read ? 'bg-brand-navy/[0.04]' : 'bg-white'}`}
                                >
                                  <div className="mb-1 flex items-center justify-between gap-3">
                                    <p className={`text-xs font-black truncate ${!n.read ? 'text-brand-navy' : 'text-slate-700'}`}>{n.title}</p>
                                    <span className="text-[9px] font-bold text-slate-400">{new Date(n.createdAt).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}</span>
                                  </div>
                                  <p className="text-[11px] font-bold leading-relaxed text-slate-500">{n.message}</p>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                    className="absolute left-4 top-1/2 -translate-y-1/2 opacity-0 group-hover/item:opacity-100 h-7 w-7 rounded-lg bg-slate-100 text-slate-400 hover:bg-red-50 hover:text-red-500 transition flex items-center justify-center shadow-sm"
                                    title="حذف"
                                  >
                                    <i className="fa-solid fa-trash-can text-[10px]"></i>
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="p-10 text-center text-slate-300">
                          <i className="fa-solid fa-bell-slash mb-3 block text-3xl opacity-20"></i>
                          <p className="text-xs font-bold">لا توجد إشعارات متاحة</p>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 rounded-xl p-1 transition-all ${isProfileOpen ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <motion.div
                  animate={{ height: isScrolled ? 28 : 32, width: isScrolled ? 28 : 32 }}
                  transition={headerTransition}
                  className={`${isScrolled ? 'h-7 w-7' : 'h-8 w-8'} overflow-hidden rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-200 transition-all`}
                >
                  <img src={displayAvatar} alt="" className="h-full w-full object-cover" />
                </motion.div>
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`}></i>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                    <motion.div
                      initial={prefersReducedMotion ? false : { opacity: 0, y: 12, scale: 0.96, filter: 'blur(8px)' }}
                      animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                      exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: 10, scale: 0.96, filter: 'blur(8px)' }}
                      transition={menuTransition}
                      className="absolute left-0 mt-2 w-56 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-20 text-right"
                    >
                      <div className="px-3 py-3 border-b border-slate-50 mb-1">
                        <p className="text-xs font-black text-brand-navy">{displayName}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{displayRole}</p>
                      </div>
                      {user ? (
                        <>
                          <button
                            onClick={() => { navigate(ownProfilePath); setIsProfileOpen(false); }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-navy transition-colors"
                          >
                            <i className="fa-regular fa-id-card opacity-50"></i>
                            {ownProfileLabel}
                          </button>
                          <button
                            onClick={() => { navigate('/settings'); setIsProfileOpen(false); }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-navy transition-colors"
                          >
                            <i className="fa-solid fa-user-gear opacity-50"></i>
                            الإعدادات
                          </button>
                          <button
                            onClick={() => { navigate('/following'); setIsProfileOpen(false); }}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                          >
                            <i className="fa-solid fa-user-check opacity-50"></i>
                            المحامون المحفوظون
                          </button>
                          <div className="my-1 h-px bg-slate-50"></div>
                          <button
                            onClick={handleLogout}
                            className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <i className="fa-solid fa-arrow-right-from-bracket opacity-70"></i>
                            تسجيل الخروج
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={handleLogin}
                          className="flex w-full items-center justify-between rounded-xl bg-brand-navy px-3 py-2.5 text-[13px] font-bold text-white transition-colors hover:bg-brand-dark"
                        >
                          <i className="fa-solid fa-arrow-right-to-bracket opacity-80"></i>
                          تسجيل الدخول
                        </button>
                      )}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Nav Toggle */}
            <motion.button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              whileTap={prefersReducedMotion ? undefined : { scale: 0.92 }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 xl:hidden transition-all hover:bg-brand-navy hover:text-white"
            >
              <AnimatePresence mode="wait" initial={false}>
                <motion.i
                  key={mobileNavOpen ? 'close' : 'menu'}
                  initial={prefersReducedMotion ? false : { opacity: 0, rotate: -45, scale: 0.75 }}
                  animate={{ opacity: 1, rotate: 0, scale: 1 }}
                  exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, rotate: 45, scale: 0.75 }}
                  transition={{ duration: 0.18 }}
                  className={`fa-solid ${mobileNavOpen ? 'fa-xmark' : 'fa-bars'}`}
                />
              </AnimatePresence>
            </motion.button>
          </div>
        </div>
      </motion.header>

      {/* Enhanced Mobile Navigation Overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: -18, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -14, filter: 'blur(8px)' }}
            transition={menuTransition}
            className="fixed inset-0 z-[45] flex flex-col bg-white/95 px-6 pt-24 backdrop-blur-md xl:hidden"
          >
            <nav className="flex flex-col gap-2">
              {navItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onMouseEnter={() => prefetchRoute(item.path)}
                    onFocus={() => prefetchRoute(item.path)}
                    onClick={() => setMobileNavOpen(false)}
                    className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${isActive
                      ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/20'
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
                      }`}
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${isActive ? 'bg-white/20' : 'bg-white shadow-sm border border-slate-100'}`}>
                      <i className={`fa-solid ${item.icon} ${isActive ? 'text-white' : 'text-brand-navy'}`}></i>
                    </div>
                    <span className="text-lg font-black">{item.name}</span>
                    {isActive && <i className="fa-solid fa-chevron-left mr-auto text-xs opacity-50"></i>}
                  </Link>
                );
              })}
            </nav>

            <div className="mt-auto mb-10 space-y-6 pt-8 border-t border-slate-100">
              <div className="flex flex-row-reverse items-center gap-4 px-2">
                <img src={displayAvatar} className="h-14 w-14 rounded-2xl border-2 border-white shadow-lg" alt="" />
                <div className="text-right">
                  <p className="text-lg font-black text-brand-dark">{displayName}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{displayRole}</p>
                </div>
              </div>

              {user ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => { navigate(ownProfilePath); setMobileNavOpen(false); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-5 text-slate-600 transition hover:bg-slate-200">
                    <i className="fa-regular fa-id-card text-xl"></i>
                    <span className="text-xs font-black">{ownProfileLabel}</span>
                  </button>
                  <button onClick={() => { navigate('/settings'); setMobileNavOpen(false); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-5 text-slate-600 transition hover:bg-slate-200">
                    <i className="fa-solid fa-user-gear text-xl"></i>
                    <span className="text-xs font-black">الإعدادات</span>
                  </button>
                  <button onClick={() => { navigate('/following'); setMobileNavOpen(false); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-5 text-slate-600 transition hover:bg-slate-200">
                    <i className="fa-solid fa-user-check text-xl"></i>
                    <span className="text-xs font-black">المحفوظون</span>
                  </button>
                  <button onClick={handleLogout} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-red-50 p-5 text-red-500 transition hover:bg-red-100">
                    <i className="fa-solid fa-arrow-right-from-bracket text-xl"></i>
                    <span className="text-xs font-black">تسجيل الخروج</span>
                  </button>
                </div>
              ) : (
                <button onClick={handleLogin} className="flex w-full items-center justify-center gap-3 rounded-2xl bg-brand-navy p-5 text-white transition hover:bg-brand-dark">
                  <i className="fa-solid fa-arrow-right-to-bracket text-lg"></i>
                  <span className="text-sm font-black">تسجيل الدخول</span>
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {systemSettings?.announcement && (
        <div className="mx-auto mt-2 max-w-[1400px] rounded-3xl bg-brand-gold/10 px-4 py-4 text-right text-[#1B365D] shadow-sm md:px-6 lg:px-8">
          <p className="text-sm font-semibold">إشعار النظام:</p>
          <p className="mt-1 text-xs leading-relaxed text-current/90">{systemSettings.announcement}</p>
        </div>
      )}

      {systemSettings?.maintenanceMode && user?.role !== 'admin' && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-white/95 p-6 text-right">
          <div className="max-w-2xl rounded-3xl border border-gray-200 bg-white p-8 shadow-2xl">
            <h2 className="mb-4 text-2xl font-bold text-brand-dark">النظام تحت الصيانة</h2>
            <p className="mb-4 text-gray-600">{systemSettings.offlineMessage}</p>
            <p className="text-sm text-gray-500">
              للمساعدة، تواصل مع: <span className="font-semibold text-brand-dark">{systemSettings.supportEmail}</span>
            </p>
          </div>
        </div>
      )}

      {user && currentPageInsight && (
        <section className="mx-auto mt-3 w-full max-w-[1400px] px-4 md:px-6 lg:px-8">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-right shadow-sm lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy">
                <i className={`fa-solid ${currentPageInsight.icon} text-sm`}></i>
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-brand-dark">{currentPageInsight.title}</p>
                <p className="mt-1 line-clamp-1 text-xs font-bold text-slate-500">{currentPageInsight.summary}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:justify-end">
              {predictiveQuickAction && (
                <button
                  type="button"
                  onMouseEnter={() => prefetchRoute(predictiveQuickAction.target)}
                  onFocus={() => prefetchRoute(predictiveQuickAction.target)}
                  onClick={() => {
                    prefetchRoute(predictiveQuickAction.target);
                    navigate(predictiveQuickAction.target);
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-gold px-3 py-2.5 text-[10px] font-black text-brand-dark transition hover:bg-amber-300"
                >
                  <i className={`fa-solid ${predictiveQuickAction.icon || 'fa-bolt'}`}></i>
                  {predictiveQuickAction.label}
                </button>
              )}
              {pageRecommendation?.aiBrief && (
                <button
                  type="button"
                  onClick={() => runPageAnalysis(pageRecommendation.aiBrief)}
                  className="flex items-center justify-center gap-2 rounded-xl bg-brand-navy px-3 py-2.5 text-[10px] font-black text-white transition hover:bg-brand-dark"
                >
                  <i className="fa-solid fa-wand-magic-sparkles"></i>
                  {pageRecommendation.aiAction || 'حلل الأولوية'}
                </button>
              )}
              <button
                type="button"
                onClick={() => runPageAnalysis()}
                className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-[10px] font-black text-brand-navy transition hover:border-brand-navy hover:bg-white"
              >
                <i className="fa-solid fa-brain"></i>
                تحليل الصفحة
              </button>
              {learnedNextRoute && (
                <button
                  type="button"
                  onMouseEnter={() => prefetchRoute(learnedNextRoute.path)}
                  onFocus={() => prefetchRoute(learnedNextRoute.path)}
                  onClick={() => {
                    prefetchRoute(learnedNextRoute.path);
                    navigate(learnedNextRoute.path);
                  }}
                  className="hidden items-center justify-center gap-2 rounded-xl border border-brand-gold/30 bg-brand-gold/10 px-3 py-2.5 text-[10px] font-black text-brand-dark transition hover:border-brand-gold hover:bg-brand-gold/20 md:flex"
                >
                  <i className={`fa-solid ${learnedNextRoute.icon}`}></i>
                  تابع: {learnedNextRoute.name}
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsCommandPaletteOpen(true)}
                className="hidden items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[10px] font-black text-slate-500 transition hover:border-brand-navy hover:text-brand-navy sm:flex"
              >
                <i className="fa-solid fa-magnifying-glass"></i>
                أوامر ذكية
              </button>
            </div>
          </div>
        </section>
      )}

      <main className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">
        <Outlet context={{ setSosOpen }} />
      </main>

      <GlobalIntelligencePanel open={intelligenceOpen} onClose={() => setIntelligenceOpen(false)} />

      {sosOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-dark/80 p-4 backdrop-blur-sm fade-in">
          <div className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl transition-transform duration-300">
            <button onClick={() => setSosOpen(false)} className="absolute left-4 top-4 text-gray-400 transition hover:text-red-500">
              <i className="fa-solid fa-times text-xl"></i>
            </button>
            <div className="mb-6 text-center">
              <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 text-4xl text-red-600 animate-pulse">
                <i className="fa-solid fa-triangle-exclamation"></i>
              </div>
              <h2 className="text-2xl font-bold text-brand-dark">طوارئ قانونية عاجلة</h2>
              <p className="mt-2 text-sm text-gray-500">
                سيتم توصيلك بأول محامٍ متاح للرد الفوري خلال أقل من دقيقة. هذا الخيار مخصص لحالات الاعتقال، الحوادث المرورية، أو التدخل الأمني.
              </p>
            </div>
            <div className="mb-6 space-y-4">
              <button
                onClick={() => setSosOpen(false)}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-red-600 py-4 font-bold text-white transition hover:bg-red-700 shadow-lg shadow-red-500/30"
              >
                <i className="fa-solid fa-phone-volume"></i> اتصال طوارئ (100,000 د.ع)
              </button>
              <button
                onClick={() => setSosOpen(false)}
                className="flex w-full items-center justify-center gap-3 rounded-xl bg-gray-100 py-4 font-bold text-gray-700 transition hover:bg-gray-200"
              >
                <i className="fa-solid fa-comment-sms"></i> دردشة طوارئ (50,000 د.ع)
              </button>
            </div>
            <p className="text-center text-[10px] text-gray-400">بضغطك على أزرار الطوارئ أنت توافق على اقتطاع المبلغ من محفظتك فوراً.</p>
          </div>
        </div>
      )}

      {/* Global Command Palette */}
      <AnimatePresence>
        {isCommandPaletteOpen && (
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
                  placeholder="ابحث عن صفحة، إجراء، أو ميزة..."
                  className="w-full bg-transparent pr-12 text-lg font-bold text-brand-dark outline-none placeholder:text-slate-300 text-right"
                  value={commandQuery}
                  onChange={(e) => setCommandQuery(e.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && commandResults[0]) {
                      event.preventDefault();
                      executeCommand(commandResults[0]);
                    }
                  }}
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {commandResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="mb-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                      {commandQuery ? 'أفضل النتائج' : 'اقتراحات ذكية الآن'}
                    </p>
                    {commandResults.map((res) => (
                      <button
                        key={res.id}
                        onMouseEnter={() => prefetchRoute(res.path)}
                        onFocus={() => prefetchRoute(res.path)}
                        onClick={() => executeCommand(res)}
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
                    <p className="text-sm font-bold">{commandQuery ? 'لا توجد نتائج تطابق بحثك' : 'ابدأ الكتابة للبحث السريع (Ctrl+K)...'}</p>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
