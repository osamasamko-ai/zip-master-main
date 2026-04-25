import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Outlet, Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [systemSettings, setSystemSettings] = useState<{
    maintenanceMode: boolean;
    announcement: string;
    offlineMessage: string;
    supportEmail: string;
  } | null>(null);
  const [sosOpen, setSosOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [isScrolled, setIsScrolled] = useState(false);

  // Breadcrumb mapping
  const pathMap: Record<string, string> = {
    'user': 'الرئيسية',
    'cases': 'القضايا',
    'following': 'المتابعون',
    'legal': 'القوانين',
    'aichat': 'المستشار الذكي',
    'pro': 'مكتب المحامي',
    'admin': 'الإدارة',
    'profile': 'الملف الشخصي',
    'settings': 'الإعدادات',
  };

  const pathnames = location.pathname.split('/').filter((x) => x);

  // Helper to resolve dynamic titles for IDs
  const getBreadcrumbLabel = (name: string, index: number, allSegments: string[]) => {
    // 1. Check static map first
    if (pathMap[name]) return pathMap[name];

    // 2. Handle ID patterns (e.g., case-123, doc-456)
    const parent = index > 0 ? allSegments[index - 1] : null;

    if (parent === 'cases' || parent === 'pro') {
      return (name.includes('-') || !isNaN(Number(name))) ? 'ملف القضية' : name; // Changed to be more generic
    }

    return name;
  };

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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

  const commandResults = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) return [];

    // Common navigation shortcuts
    const items = [
      { id: 'n1', type: 'ملاحة', title: 'القضايا النشطة', subtitle: 'متابعة سير العمل', icon: 'fa-folder-open', path: '/cases' },
      { id: 'n2', type: 'ملاحة', title: 'البحث القانوني', subtitle: 'قاعدة القوانين العراقية', icon: 'fa-gavel', path: '/legal' },
      { id: 'n3', type: 'ملاحة', title: 'المستشار الذكي', subtitle: 'توليد مسودات بالذكاء الاصطناعي', icon: 'fa-robot', path: '/aichat' },
      { id: 'n4', type: 'ملاحة', title: 'الإعدادات', subtitle: 'إدارة الحساب والأمان والتفضيلات', icon: 'fa-user-gear', path: '/settings' },
    ];

    if (user?.role === 'admin') {
      items.push({ id: 'a1', type: 'إدارة', title: 'لوحة التحكم', subtitle: 'إدارة النظام والمستخدمين', icon: 'fa-server', path: '/admin' });
    }
    if (user?.role === 'pro') {
      items.push({ id: 'p1', type: 'احترافي', title: 'مكتب المحامي', subtitle: 'إدارة القضايا والعملاء', icon: 'fa-briefcase', path: '/pro' });
    }

    return items.filter(
      (item) =>
        item.title.toLowerCase().includes(query) ||
        item.subtitle.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query)
    );
  }, [commandQuery, user?.role]);

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const response = await fetch('/api/admin/system-settings');
        if (!response.ok) return;
        setSystemSettings(await response.json());
      } catch {
        // keep default behavior
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (typeof document === 'undefined') return;

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
        { name: 'الرئيسية', icon: 'fa-user-shield', path: '/user' },
        { name: 'القضايا', icon: 'fa-folder-open', path: '/cases' },
        { name: 'المتابعون', icon: 'fa-user-check', path: '/following' },
        { name: 'القوانين', icon: 'fa-gavel', path: '/legal' },
        { name: 'الذكاء القانوني', icon: 'fa-robot', path: '/aichat', accent: true },
        { name: 'المحامي', icon: 'fa-briefcase', path: '/pro', visible: user?.role === 'pro' || user?.role === 'admin' },
        { name: 'الإدارة', icon: 'fa-server', path: '/admin', visible: user?.role === 'admin' },
      ].filter((item) => item.visible !== false),
    [user?.role]
  );

  return (
    <div className="flex min-h-screen w-full flex-col">
      <header className={`sticky top-0 z-50 w-full border-b border-slate-200/60 bg-white/70 backdrop-blur-xl transition-all duration-300 ${isScrolled ? 'h-14 shadow-sm' : 'h-16'}`}>
        <div className="mx-auto flex h-full max-w-[1440px] items-center justify-between px-4 sm:px-6 lg:px-8">

          {/* Brand & Logo */}
          <div className="flex items-center gap-3 lg:w-64">
            <motion.div animate={{ scale: isScrolled ? 0.9 : 1 }} className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy text-brand-gold shadow-lg shadow-brand-navy/20">
              <i className={`fa-solid fa-scale-balanced ${isScrolled ? 'text-xs' : 'text-sm'}`}></i>
            </motion.div>
            <div className={`hidden text-right sm:block transition-all ${isScrolled ? 'opacity-0 scale-95 w-0' : 'opacity-100'}`}>
              <p className="text-base font-black tracking-tight text-brand-navy leading-none">القسطاس</p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-widest text-slate-400">Smart Legal Platform</p>
            </div>
          </div>

          {/* Center Navigation */}
          <nav className="hidden h-full items-center gap-1 xl:flex">
            {navItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`group relative flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-bold transition-all ${isActive
                    ? 'bg-brand-navy/5 text-brand-navy'
                    : 'text-slate-500 hover:text-brand-navy hover:bg-slate-50'
                    }`}
                >
                  <i className={`fa-solid ${item.icon} text-xs ${isActive ? 'text-brand-navy' : 'text-slate-300 group-hover:text-brand-navy'}`}></i>
                  {item.name}
                  {isActive && (
                    <motion.div layoutId="nav-pill" className="absolute inset-x-2 -bottom-3 h-1 rounded-t-full bg-brand-navy" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Right Actions */}
          <div className="flex items-center justify-end gap-2 lg:w-64">
            <button
              onClick={() => setIsCommandPaletteOpen(true)}
              className={`flex items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-400 transition-all hover:border-brand-navy hover:text-brand-navy hover:shadow-sm ${isScrolled ? 'h-9 w-9' : 'h-10 w-10'}`}
              title="البحث السريع (Ctrl+K)"
            >
              <i className="fa-solid fa-magnifying-glass text-xs"></i>
            </button>

            <div className="relative">
              <button
                className={`flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 transition-all hover:bg-white hover:text-brand-navy hover:shadow-sm group ${isScrolled ? 'h-9 w-9' : 'h-10 w-10'}`}
              >
                <i className="fa-regular fa-bell"></i>
                <span className={`absolute flex h-2 w-2 ${isScrolled ? 'right-2 top-2' : 'right-2.5 top-2.5'}`}>
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
                </span>
              </button>
            </div>

            <div className="h-6 w-px bg-slate-200 mx-1"></div>

            {/* Profile Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsProfileOpen(!isProfileOpen)}
                className={`flex items-center gap-2 rounded-xl p-1 transition-all ${isProfileOpen ? 'bg-slate-100' : 'hover:bg-slate-50'}`}
              >
                <div className={`${isScrolled ? 'h-7 w-7' : 'h-8 w-8'} overflow-hidden rounded-lg border-2 border-white shadow-sm ring-1 ring-slate-200 transition-all`}>
                  <img src={user?.img || 'https://i.pravatar.cc/150'} alt="" className="h-full w-full object-cover" />
                </div>
                <i className={`fa-solid fa-chevron-down text-[10px] text-slate-400 transition-transform duration-300 ${isProfileOpen ? 'rotate-180' : ''}`}></i>
              </button>

              <AnimatePresence>
                {isProfileOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setIsProfileOpen(false)}></div>
                    <motion.div
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 mt-2 w-56 origin-top-left rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl z-20 text-right"
                    >
                      <div className="px-3 py-3 border-b border-slate-50 mb-1">
                        <p className="text-xs font-black text-brand-navy">{user?.name}</p>
                        <p className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-tight">{user?.roleDescription}</p>
                      </div>
                      <button
                        onClick={() => { navigate('/settings'); setIsProfileOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 hover:text-brand-navy transition-colors"
                      >
                        <i className="fa-regular fa-user-circle opacity-50"></i>
                        الإعدادات
                      </button>
                      <button
                        onClick={() => { navigate('/following'); setIsProfileOpen(false); }}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-slate-600 hover:bg-slate-50 transition-colors"
                      >
                        <i className="fa-solid fa-user-check opacity-50"></i>
                        قائمة المتابعة
                      </button>
                      <div className="my-1 h-px bg-slate-50"></div>
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-red-500 hover:bg-red-50 transition-colors"
                      >
                        <i className="fa-solid fa-arrow-right-from-bracket opacity-70"></i>
                        تسجيل الخروج
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Mobile Nav Toggle */}
            <button
              onClick={() => setMobileNavOpen(!mobileNavOpen)}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-50 text-slate-600 xl:hidden transition-all hover:bg-brand-navy hover:text-white"
            >
              <i className={`fa-solid ${mobileNavOpen ? 'fa-xmark' : 'fa-bars'}`}></i>
            </button>
          </div>
        </div>
      </header>

      {/* Enhanced Mobile Navigation Overlay */}
      <AnimatePresence>
        {mobileNavOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
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
                    className={`flex items-center gap-4 rounded-2xl p-4 transition-all ${
                      isActive
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
                <img src={user?.img || 'https://i.pravatar.cc/150'} className="h-14 w-14 rounded-2xl border-2 border-white shadow-lg" alt="" />
                <div className="text-right">
                  <p className="text-lg font-black text-brand-dark">{user?.name}</p>
                  <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">{user?.roleDescription}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => { navigate('/settings'); setMobileNavOpen(false); }} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-slate-100 p-5 text-slate-600 transition hover:bg-slate-200">
                  <i className="fa-regular fa-user-circle text-xl"></i>
                  <span className="text-xs font-black">الإعدادات</span>
                </button>
                <button onClick={handleLogout} className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-red-50 p-5 text-red-500 transition hover:bg-red-100">
                  <i className="fa-solid fa-arrow-right-from-bracket text-xl"></i>
                  <span className="text-xs font-black">تسجيل الخروج</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Breadcrumbs */}
      <div className="mx-auto w-full max-w-[1440px] px-4 pt-4 sm:px-6 lg:px-8">
        <nav className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 overflow-x-auto no-scrollbar whitespace-nowrap">
          <Link to="/user" className="hover:text-brand-navy transition-colors">
            <i className="fa-solid fa-house-chimney"></i>
          </Link>
          {pathnames.length > 0 && <i className="fa-solid fa-chevron-left text-[7px] opacity-30"></i>}
          {pathnames.map((name, index) => {
            const routeTo = `/${pathnames.slice(0, index + 1).join('/')}`;
            const isLast = index === pathnames.length - 1;
            const label = getBreadcrumbLabel(name, index, pathnames);

            return (
              <React.Fragment key={name}>
                {isLast ? (
                  <span className="text-brand-gold">{label}</span>
                ) : (
                  <>
                    <Link to={routeTo} className="hover:text-brand-navy transition-colors">{label}</Link>
                    <i className="fa-solid fa-chevron-left text-[7px] opacity-30"></i>
                  </>
                )}
              </React.Fragment>
            );
          })}
        </nav>
      </div>

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
