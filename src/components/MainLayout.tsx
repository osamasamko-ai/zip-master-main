import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion, useScroll } from 'framer-motion';
import { useNotifications } from '../context/NotificationContext';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const prefersReducedMotion = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const { NotificationBell, notifications, isNotificationsOpen, setIsNotificationsOpen, markAsRead, deleteNotification, clearAllNotifications } = useNotifications();
  const [systemSettings, setSystemSettings] = useState<{
    maintenanceMode: boolean;
    announcement: string;
    offlineMessage: string;
    supportEmail: string;
  } | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [notificationsFilter, setNotificationsFilter] = useState<'all' | 'unread'>('unread');
  const notificationsMenuRef = useRef<HTMLDivElement | null>(null);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

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
    'case-store': 'متجر القضايا',
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
  const ownProfileLabel = user?.role === 'pro' ? 'ملفي العام' : 'الملف الشخصي';

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return [];

    // Common navigation shortcuts
    const items = [
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
    if (user?.role === 'pro') {
      items.push({ id: 'p1', type: 'احترافي', title: 'المكتب', subtitle: 'إدارة القضايا والعملاء', icon: 'fa-briefcase', path: '/pro' });
      items.push({ id: 'p2', type: 'احترافي', title: 'متجر القضايا', subtitle: 'مراجعة الدعاوى المتاحة وقبولها', icon: 'fa-store', path: '/case-store' });
    }
    if (user?.role === 'admin') {
      items.push({ id: 'p2a', type: 'احترافي', title: 'متجر القضايا', subtitle: 'مراجعة الدعاوى المتاحة وقبولها', icon: 'fa-store', path: '/case-store' });
    }

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
    );
  }, [commandQuery, ownProfilePath, user?.role]);

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
  }, [location.pathname]);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('dir', 'rtl');
    root.lang = 'ar';
    root.classList.remove('dark');
    root.classList.add('light');
    root.style.colorScheme = 'light';
    window.localStorage.removeItem('app-theme');
  }, []);

  const navItems = useMemo(
    () =>
      [
        { name: 'الرئيسية', icon: 'fa-table-columns', path: '/user' },
        { name: 'القضايا', icon: 'fa-folder-open', path: '/cases' },
        { name: 'المحامون', icon: 'fa-scale-balanced', path: '/lawyers' },
        { name: 'العقود', icon: 'fa-file-contract', path: '/contracts' },
        { name: 'خطتي', icon: 'fa-route', path: '/action-plan' },
        { name: 'الرسائل', icon: 'fa-comments', path: '/messages' },
        { name: 'تواصل', icon: 'fa-users-rectangle', path: '/feed' },
        { name: 'المكتبة', icon: 'fa-book-open', path: '/legal' },
        { name: 'المساعد', icon: 'fa-robot', path: '/aichat' },
        { name: 'المدفوعات', icon: 'fa-wallet', path: '/billing' },
        { name: 'المحامي', icon: 'fa-briefcase', path: '/pro', visible: user?.role === 'pro' || user?.role === 'admin' },
        { name: 'المتجر', icon: 'fa-store', path: '/case-store', visible: user?.role === 'pro' || user?.role === 'admin' },
        { name: 'الإدارة', icon: 'fa-server', path: '/admin', visible: user?.role === 'admin' },
      ].filter((item) => item.visible !== false),
    [user?.role]
  );

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
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
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
                    className={`group relative flex items-center gap-2 overflow-hidden rounded-xl px-4 py-2 text-sm font-bold transition-colors ${isActive
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
                    <span className="relative z-10">{item.name}</span>
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
          </motion.nav>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-2 lg:w-64">
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

      <main className="relative mx-auto flex min-h-0 w-full max-w-[1400px] flex-1 p-4 md:p-6 lg:p-8">
        <Outlet context={{ setSosOpen }} />
      </main>

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
                />
              </div>

              <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                {commandResults.length > 0 ? (
                  <div className="space-y-2">
                    <p className="mb-2 pr-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">التنقل السريع</p>
                    {commandResults.map((res) => (
                      <button
                        key={res.id}
                        onClick={() => { navigate(res.path); setIsCommandPaletteOpen(false); }}
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
