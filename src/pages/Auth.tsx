import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, Variants, motion } from 'framer-motion';
import { Role, useAuth } from '../context/AuthContext';

const VALUE_POINTS = [
  'اختر محامياً مناسباً خلال دقائق.',
  'تابع القضية والرسائل من مكان واحد.',
  'احفظ مستنداتك القانونية بشكل منظم.',
];

const DEMO_ACCOUNTS = [
  { label: 'عميل تجريبي', email: 'user@example.com', password: 'password123', icon: 'fa-user' },
  { label: 'محامي تجريبي', email: 'lawyer@example.com', password: 'password123', icon: 'fa-user-tie' },
  { label: 'مدير', email: 'admin@example.com', password: 'password123', icon: 'fa-user-shield' },
];

const PASSWORD_HINTS = [
  { key: 'minLength', text: '8 أحرف على الأقل' },
  { key: 'hasUpperCase', text: 'حرف كبير واحد على الأقل' },
  { key: 'hasNumber', text: 'رقم واحد على الأقل' },
  { key: 'hasSpecial', text: 'رمز خاص واحد على الأقل' },
] as const;

type PasswordRequirementKey = (typeof PASSWORD_HINTS)[number]['key'];
type RecentAuthAccount = {
  email: string;
  name: string;
  role?: string;
  img?: string;
  lastLoginAt: string;
};

const isProfessionalRole = (role?: string | null) => role === 'pro' || role === 'lawyer';
const routeForRole = (role?: string | null) => role === 'admin' ? '/admin' : isProfessionalRole(role) ? '/pro' : '/user';
const RECENT_AUTH_ACCOUNTS_KEY = 'recentAuthAccounts';

function getRoleLabel(role?: string | null) {
  if (role === 'admin') return 'مدير المنصة';
  if (isProfessionalRole(role)) return 'محامي';
  return 'عميل';
}

function getAccountInitials(account: RecentAuthAccount) {
  const source = account.name || account.email;
  return source
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

function readRecentAccounts(): RecentAuthAccount[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(RECENT_AUTH_ACCOUNTS_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.slice(0, 4) : [];
  } catch {
    return [];
  }
}

function writeRecentAccount(account: RecentAuthAccount) {
  if (typeof window === 'undefined') return;
  const next = [
    account,
    ...readRecentAccounts().filter((item) => item.email !== account.email),
  ].slice(0, 4);
  window.localStorage.setItem(RECENT_AUTH_ACCOUNTS_KEY, JSON.stringify(next));
}

const authPanelVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
  exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
};

function getPasswordStrengthLabel(score: number) {
  const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً'];
  const colors = ['bg-slate-200', 'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500'];
  return { label: labels[score], color: colors[score] };
}

export default function Auth() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [documentIdInput, setDocumentIdInput] = useState('');
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [authUtilityTab, setAuthUtilityTab] = useState<'account' | 'verify'>('account');
  const [recentAccounts, setRecentAccounts] = useState<RecentAuthAccount[]>([]);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
    setRecentAccounts(readRecentAccounts());
  }, []);

  const isRegisterMode = authMode === 'register';

  const normalizeEmail = (value: string) => value.trim().toLowerCase();
  const normalizeLoginIdentifier = (value: string) => {
    const trimmed = value.trim();
    return trimmed.includes('@') ? trimmed.toLowerCase() : trimmed;
  };
  const normalizePhone = (value: string) => value.replace(/\D/g, '');

  const markFieldTouched = (fieldName: string) => {
    setTouchedFields((prev) => new Set([...prev, fieldName]));
  };

  const switchMode = (mode: 'login' | 'register') => {
    setAuthMode(mode);
    setError(null);
    setTouchedFields(new Set());
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (checked && email) {
      localStorage.setItem('rememberedEmail', email);
      return;
    }
    localStorage.removeItem('rememberedEmail');
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', value);
    }
  };

  const resetRegisterFields = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setSelectedRole('user');
    setTouchedFields(new Set());
    setShowPassword(false);
    setShowConfirmPassword(false);
  };

  const emailPreview = normalizeEmail(email);
  const loginIdentifierPreview = normalizeLoginIdentifier(email);
  const forgotEmailPreview = normalizeEmail(forgotEmail);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPreview);
  const phoneLooksValid = normalizePhone(email).length >= 7;
  const loginIdentifierLooksValid = emailLooksValid || phoneLooksValid;
  const forgotEmailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotEmailPreview);
  const passwordsMatch = confirmPassword !== '' && password === confirmPassword;
  const passwordsMismatch = confirmPassword !== '' && password !== confirmPassword;

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!password) return 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const passwordRequirements = useMemo(
    () => ({
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    }),
    [password],
  );

  const registerChecklist = [
    { label: 'الاسم الكامل', met: name.trim().length > 1 },
    { label: 'بريد صحيح', met: emailLooksValid },
    { label: 'كلمة مرور قوية', met: passwordStrength >= 3 },
    { label: 'تأكيد مطابق', met: passwordsMatch },
  ];

  const canSubmitLogin = loginIdentifierLooksValid && password.length > 0 && !loading;
  const canSubmitRegister = registerChecklist.every((item) => item.met) && !loading;
  const destinationPreview = isRegisterMode
    ? selectedRole === 'pro' ? 'سيتم توجيهك إلى لوحة المحامي بعد إنشاء الحساب.' : 'سيتم توجيهك إلى لوحة العميل بعد إنشاء الحساب.'
    : 'سيتم توجيهك تلقائياً إلى لوحة التحكم المناسبة لحسابك.';
  const smartAuthInsight = useMemo(() => {
    if (isRegisterMode) {
      if (selectedRole === 'pro') {
        return {
          icon: 'fa-user-tie',
          title: 'مسار محامي ذكي',
          text: 'بعد التسجيل ستدخل إلى مكتبي لإدارة القضايا، ثم يمكنك إكمال بيانات الترخيص لرفع الثقة والظهور.',
          tone: 'bg-brand-navy/5 text-brand-navy border-brand-navy/10',
        };
      }
      return {
        icon: 'fa-folder-open',
        title: 'مسار عميل واضح',
        text: 'سنبدأ بلوحة العميل، ومنها يمكنك البحث عن محام، فتح قضية، أو متابعة رسائلك.',
        tone: 'bg-blue-50 text-blue-700 border-blue-100',
      };
    }

    const matchedAccount = recentAccounts.find((account) => account.email === loginIdentifierPreview);
    if (matchedAccount) {
      return {
        icon: 'fa-clock-rotate-left',
        title: `مرحباً بعودتك يا ${matchedAccount.name.split(' ')[0] || matchedAccount.name}`,
        text: `هذا حساب ${getRoleLabel(matchedAccount.role)} محفوظ على هذا الجهاز. أدخل كلمة المرور فقط للمتابعة.`,
        tone: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      };
    }

    return null;
  }, [isRegisterMode, loginIdentifierPreview, recentAccounts, selectedRole]);

  const getFieldError = (fieldName: string) => {
    if (!error) return false;

    const lowerError = error.toLowerCase();
    const isLoginError =
      authMode === 'login' &&
      (lowerError.includes('credentials') ||
        lowerError.includes('failed') ||
        error.includes('التحقق') ||
        error.includes('بيانات الدخول') ||
        error.includes('خطأ'));

    if (fieldName === 'name') return error.includes('الاسم');
    if (fieldName === 'email') return error.includes('البريد') || error.includes('رقم') || isLoginError;
    if (fieldName === 'password') return (error.includes('كلمة المرور') && !error.includes('تأكيد')) || isLoginError;
    if (fieldName === 'confirmPassword') return error.includes('تأكيد');
    return false;
  };

  const validateRegisterForm = () => {
    const trimmedName = name.trim();
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedName) return 'يرجى إدخال الاسم الكامل.';
    if (!normalizedEmail) return 'يرجى إدخال البريد الإلكتروني.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return 'صيغة البريد الإلكتروني غير صحيحة.';
    if (password.length < 8) return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
    if (password !== confirmPassword) return 'تأكيد كلمة المرور غير مطابق.';
    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await login(normalizeLoginIdentifier(email), password);
      writeRecentAccount({
        email: loggedInUser.email || normalizeEmail(email),
        name: loggedInUser.name || normalizeEmail(email),
        role: loggedInUser.role,
        img: loggedInUser.img || loggedInUser.avatar,
        lastLoginAt: new Date().toISOString(),
      });
      setRecentAccounts(readRecentAccounts());
      navigate(routeForRole(loggedInUser.role));
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (demo: (typeof DEMO_ACCOUNTS)[number]) => {
    switchMode('login');
    setAuthUtilityTab('account');
    setEmail(demo.email);
    setPassword(demo.password);
    setError(null);
  };

  const handleRecentAccountSelect = (account: RecentAuthAccount) => {
    switchMode('login');
    setAuthUtilityTab('account');
    setEmail(account.email);
    setPassword('');
    setRememberMe(true);
    window.localStorage.setItem('rememberedEmail', account.email);
    window.setTimeout(() => passwordInputRef.current?.focus(), 50);
  };

  const forgetRecentAccount = (emailToRemove: string) => {
    const next = recentAccounts.filter((account) => account.email !== emailToRemove);
    setRecentAccounts(next);
    window.localStorage.setItem(RECENT_AUTH_ACCOUNTS_KEY, JSON.stringify(next));
    if (normalizeEmail(email) === emailToRemove) {
      setEmail('');
      setPassword('');
      window.localStorage.removeItem('rememberedEmail');
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setTouchedFields(new Set(['name', 'email', 'password', 'confirmPassword']));

    const validationError = validateRegisterForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);

    try {
      const registeredUser = await register(normalizeEmail(email), password, name.trim(), selectedRole);
      writeRecentAccount({
        email: registeredUser.email || normalizeEmail(email),
        name: registeredUser.name || name.trim(),
        role: registeredUser.role,
        img: registeredUser.img || registeredUser.avatar,
        lastLoginAt: new Date().toISOString(),
      });
      setRecentAccounts(readRecentAccounts());
      resetRegisterFields();
      navigate(routeForRole(registeredUser.role));
    } catch (err: any) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setForgotPasswordMessage({
        type: 'success',
        text: `تم تسجيل طلب الاستعادة للبريد ${forgotEmailPreview}. خدمة إرسال رابط فعلي تحتاج ربط API البريد في الخادم.`,
      });

      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotPasswordMessage(null);
      }, 3000);
    } catch (err: any) {
      setForgotPasswordMessage({
        type: 'error',
        text: 'فشل إرسال رابط إعادة التعيين. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  const strengthUi = getPasswordStrengthLabel(passwordStrength);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f0f2f5]">
      <div className="absolute inset-x-0 top-0 h-72 bg-[linear-gradient(180deg,rgba(255,255,255,0.9)_0%,rgba(240,242,245,0)_100%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1180px] flex-col items-center gap-8 px-5 py-8 lg:flex-row lg:justify-between lg:px-8 lg:py-12">
        <section className="relative order-2 flex w-full px-0 py-4 sm:px-2 lg:order-1 lg:w-[52%] lg:py-0">
          <div className="relative z-10 flex w-full flex-col justify-center gap-7 lg:gap-8">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex items-center justify-between"
            >
              <div className="inline-flex items-center gap-3">
                <div className="flex h-[52px] w-[52px] items-center justify-center rounded-2xl bg-brand-navy text-brand-gold shadow-lg shadow-brand-navy/15">
                  <i className="fa-solid fa-scale-balanced text-2xl" />
                </div>
                <div className="text-right">
                  <p className="text-2xl font-black leading-none text-brand-navy">القسطاس</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">منصة قانونية عراقية رقمية</p>
                </div>
              </div>
              <div className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-600 shadow-sm md:flex md:items-center md:gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                موثوق وسهل الاستخدام
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="max-w-xl text-right"
            >
              <h1 className="max-w-xl text-4xl font-black leading-[1.12] text-brand-navy sm:text-5xl lg:text-[3.65rem]">
                مكان واحد لكل ما يخصك قانونياً.
              </h1>
              <p className="mt-5 max-w-lg text-xl font-bold leading-9 text-slate-700 sm:text-2xl">
                تواصل مع محام، تابع قضاياك، واحفظ مستنداتك القانونية بسهولة ووضوح.
              </p>
            </motion.div>

            <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="sm:col-span-3"
              >
                <div className="grid gap-3 sm:grid-cols-3">
                  {VALUE_POINTS.map((point, index) => (
                    <div key={point} className="rounded-2xl border border-slate-200 bg-white px-4 py-4 text-right shadow-sm">
                      <div className="mb-3 mr-auto flex h-9 w-9 items-center justify-center rounded-xl bg-brand-navy/5 text-brand-navy">
                        <span className="text-sm font-black">{index + 1}</span>
                      </div>
                      <p className="text-sm font-bold leading-6 text-slate-700">{point}</p>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        <section className="relative order-1 flex w-full items-center justify-center px-0 py-4 lg:order-2 lg:w-[420px] lg:py-0">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="w-full max-w-[420px]"
          >
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-[0_12px_32px_rgba(15,23,42,0.14)] sm:p-5">
              <div className="mb-5 text-center">
                <h2 className="text-xl font-black text-slate-900">
                  {isRegisterMode ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
                </h2>
                <p className="mt-1 text-sm font-bold leading-6 text-slate-500">
                  {isRegisterMode ? 'ابدأ حسابك خلال دقيقة.' : 'تابع قضاياك ورسائلك بسهولة.'}
                </p>
              </div>

              <div className="mb-4 rounded-lg bg-slate-100 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setAuthUtilityTab('account');
                      switchMode('login');
                    }}
                    className={`relative overflow-hidden rounded-md px-4 py-3 text-sm font-black transition ${!isRegisterMode ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {!isRegisterMode && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        className="absolute inset-0 rounded-md bg-white shadow-sm"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <i className="fa-solid fa-right-to-bracket text-[12px]" />
                      تسجيل الدخول
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAuthUtilityTab('account');
                      switchMode('register');
                    }}
                    className={`relative overflow-hidden rounded-md px-4 py-3 text-sm font-black transition ${isRegisterMode ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {isRegisterMode && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        className="absolute inset-0 rounded-md bg-white shadow-sm"
                      />
                    )}
                    <span className="relative z-10 inline-flex items-center gap-2">
                      <i className="fa-solid fa-user-plus text-[12px]" />
                      حساب جديد
                    </span>
                  </button>
                </div>
              </div>

              <div className="mb-4 grid grid-cols-2 gap-2 rounded-lg border border-slate-100 bg-white p-1">
                <button
                  type="button"
                  onClick={() => setAuthUtilityTab('account')}
                  className={`rounded-md px-3 py-2 text-xs font-black transition ${authUtilityTab === 'account' ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'}`}
                >
                  <i className="fa-solid fa-user-lock ml-2"></i>
                  الحساب
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAuthUtilityTab('verify');
                    setError(null);
                  }}
                  className={`rounded-md px-3 py-2 text-xs font-black transition ${authUtilityTab === 'verify' ? 'bg-brand-navy text-white shadow-sm' : 'text-slate-500 hover:bg-slate-50 hover:text-brand-navy'}`}
                >
                  <i className="fa-solid fa-qrcode ml-2"></i>
                  تحقق مستند
                </button>
              </div>

              {authUtilityTab === 'account' && smartAuthInsight && (
                <motion.div
                  key={smartAuthInsight.title}
                  variants={authPanelVariants}
                  initial="hidden"
                  animate="visible"
                  className={`mb-4 rounded-lg border px-4 py-3 text-right ${smartAuthInsight.tone}`}
                >
                  <div className="flex flex-row-reverse items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/80 shadow-sm">
                      <i className={`fa-solid ${smartAuthInsight.icon}`} />
                    </span>
                    <div>
                      <p className="text-sm font-black">{smartAuthInsight.title}</p>
                      <p className="mt-1 text-xs font-bold leading-6 opacity-80">{smartAuthInsight.text}</p>
                    </div>
                  </div>
                </motion.div>
              )}

              {authUtilityTab === 'account' && (
                <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="mb-4 flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-right"
                  >
                    <button
                      type="button"
                      onClick={() => setError(null)}
                      className="mt-0.5 text-rose-300 transition hover:text-rose-500"
                    >
                      <i className="fa-solid fa-xmark" />
                    </button>
                    <div className="flex-1">
                      <p className="text-xs font-black text-rose-700">تعذر إكمال العملية</p>
                      <p className="mt-1 text-xs font-bold leading-6 text-rose-600">{error}</p>
                    </div>
                    <div className="mt-0.5 text-rose-500">
                      <i className="fa-solid fa-circle-exclamation text-base" />
                    </div>
                  </motion.div>
                )}
                </AnimatePresence>
              )}

              <AnimatePresence mode="wait">
                {authUtilityTab === 'verify' ? (
                  <motion.div
                    key="verify-document"
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4"
                  >
                    <div className="rounded-2xl border border-brand-navy/10 bg-brand-navy/[0.03] px-4 py-4 text-right">
                      <div className="flex flex-row-reverse items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-brand-navy shadow-sm">
                          <i className="fa-solid fa-shield-halved"></i>
                        </div>
                        <div>
                          <p className="text-sm font-black text-brand-navy">التحقق دون تسجيل دخول</p>
                          <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                            أدخل رقم المستند أو رمز QR للتحقق من صحة عقد أو مستند رقمي صادر من القسطاس.
                          </p>
                        </div>
                      </div>
                    </div>
                    <div>
                      <label className="mb-2 block text-right text-[11px] font-black tracking-widest text-slate-500">
                        رقم المستند
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="مثال: contract-123"
                          value={documentIdInput}
                          onChange={(e) => setDocumentIdInput(e.target.value)}
                          className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-4 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/10"
                        />
                        <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-300">
                          <i className="fa-solid fa-qrcode" />
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/verify/${encodeURIComponent(documentIdInput.trim())}`)}
                      disabled={!documentIdInput.trim()}
                      className="flex w-full items-center justify-center gap-2 rounded-[1.3rem] bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] px-4 py-4 text-sm font-black text-white shadow-xl shadow-brand-navy/20 transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <i className="fa-solid fa-shield-check"></i>
                      تحقق الآن
                    </button>
                  </motion.div>
                ) : loading ? (
                  <motion.div
                    key="loading-skeleton"
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="space-y-4 py-3"
                  >
                    {[1, 2, 3, 4].map((item) => (
                      <div key={item} className="space-y-2">
                        <div className="mr-auto h-2.5 w-20 rounded-full bg-slate-200" />
                        <div className="h-14 rounded-[1.2rem] border border-slate-100 bg-slate-50 animate-pulse" />
                      </div>
                    ))}
                    <div className="flex flex-col items-center gap-4 pt-4">
                      <div className="relative h-12 w-12">
                        <div className="absolute inset-0 rounded-full border-4 border-brand-navy/10" />
                        <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-brand-navy animate-spin" />
                      </div>
                      <p className="text-center text-[11px] font-black tracking-[0.24em] text-brand-navy/55">
                        جاري تحضير مساحتك القانونية
                      </p>
                    </div>
                  </motion.div>
                ) : isRegisterMode ? (
                  <motion.form
                    key="register"
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleRegister}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="sm:col-span-2">
                        <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('name') ? 'text-rose-500' : 'text-slate-500'}`}>
                          الاسم الكامل
                        </label>
                        <div className="relative">
                          <input
                            type="text"
                            placeholder="الاسم كما تريد ظهوره في الحساب"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            onBlur={() => markFieldTouched('name')}
                            autoComplete="name"
                            required
                            className={`w-full rounded-[1.2rem] border px-4 py-4 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('name')
                              ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                              : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                              }`}
                          />
                          <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-300">
                            <i className="fa-solid fa-id-card" />
                          </div>
                        </div>
                      </div>

                      <div className="sm:col-span-2">
                        <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('email') ? 'text-rose-500' : 'text-slate-500'}`}>
                          البريد الإلكتروني
                        </label>
                        <div className="relative">
                          <input
                            type="email"
                            placeholder="name@example.com"
                            value={email}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            onBlur={() => markFieldTouched('email')}
                            autoComplete="email"
                            required
                            dir="ltr"
                            className={`w-full rounded-[1.2rem] border px-4 py-4 text-left text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('email')
                              ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                              : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                              }`}
                          />
                          <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-300">
                            <i className="fa-solid fa-envelope" />
                          </div>
                        </div>
                        {!getFieldError('email') && touchedFields.has('email') && email && (
                          <p className={`mt-2 text-right text-[11px] font-bold ${emailLooksValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                            {emailLooksValid ? 'صيغة البريد تبدو صحيحة.' : 'تحقق من صيغة البريد قبل المتابعة.'}
                          </p>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('password') ? 'text-rose-500' : 'text-slate-500'}`}>
                          كلمة المرور
                        </label>
                        <div className="relative">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            placeholder="اختر كلمة مرور قوية"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            onBlur={() => markFieldTouched('password')}
                            autoComplete="new-password"
                            required
                            className={`w-full rounded-[1.2rem] border pl-12 pr-4 py-4 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('password')
                              ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                              : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                              }`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword((prev) => !prev)}
                            className="absolute inset-y-0 left-3 flex items-center rounded-xl px-2 text-slate-400 transition hover:text-brand-navy"
                            aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                          >
                            <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                          </button>
                        </div>

                        {password && (
                          <div className="mt-3 rounded-[1.2rem] border border-slate-100 bg-slate-50/90 p-4">
                            <div className="flex items-center justify-between text-[11px] font-black">
                              <span className={passwordStrength >= 3 ? 'text-emerald-600' : 'text-slate-500'}>{strengthUi.label}</span>
                              <span className="text-slate-400">قوة كلمة المرور</span>
                            </div>
                            <div className="mt-3 flex gap-1.5 overflow-hidden rounded-full bg-slate-200/80">
                              {[1, 2, 3, 4].map((step) => (
                                <motion.div
                                  key={step}
                                  initial={{ scaleX: 0 }}
                                  animate={{ scaleX: 1 }}
                                  className={`h-2 flex-1 origin-right rounded-full ${passwordStrength >= step ? strengthUi.color : 'bg-slate-300'}`}
                                />
                              ))}
                            </div>
                            <div className="mt-4 grid gap-2 sm:grid-cols-2">
                              {PASSWORD_HINTS.map((requirement) => {
                                const met = passwordRequirements[requirement.key as PasswordRequirementKey];
                                return (
                                  <div
                                    key={requirement.key}
                                    className={`flex flex-row-reverse items-center justify-end gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${met ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500'
                                      }`}
                                  >
                                    <span>{requirement.text}</span>
                                    <i className={`fa-solid ${met ? 'fa-circle-check' : 'fa-circle'} text-[12px]`} />
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="sm:col-span-2">
                        <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('confirmPassword') ? 'text-rose-500' : 'text-slate-500'}`}>
                          تأكيد كلمة المرور
                        </label>
                        <div className="relative">
                          <input
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="أعد كتابة كلمة المرور"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            onBlur={() => markFieldTouched('confirmPassword')}
                            autoComplete="new-password"
                            required
                            className={`w-full rounded-[1.2rem] border pl-24 pr-4 py-4 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('confirmPassword') || passwordsMismatch
                              ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                              : passwordsMatch
                                ? 'border-emerald-300 bg-emerald-50/70 focus:border-emerald-500 focus:ring-emerald-500/10'
                                : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                              }`}
                          />
                          <div className="absolute inset-y-0 left-3 flex items-center gap-2">
                            {confirmPassword && (
                              <div
                                className={`rounded-full px-2 py-1 text-[10px] font-black ${passwordsMatch ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                                  }`}
                              >
                                {passwordsMatch ? 'متطابقة' : 'غير متطابقة'}
                              </div>
                            )}
                            <button
                              type="button"
                              onClick={() => setShowConfirmPassword((prev) => !prev)}
                              className="rounded-xl px-2 text-slate-400 transition hover:text-brand-navy"
                              aria-label={showConfirmPassword ? 'إخفاء التأكيد' : 'إظهار التأكيد'}
                            >
                              <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="mb-3 block text-right text-[11px] font-black tracking-widest text-slate-500">
                        نوع الحساب
                      </label>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <button
                          type="button"
                          onClick={() => setSelectedRole('user')}
                          className={`rounded-[1.4rem] border px-4 py-4 text-right transition ${selectedRole === 'user'
                            ? 'border-brand-navy bg-brand-navy/5 shadow-[0_14px_30px_-24px_rgba(26,35,126,0.75)]'
                            : 'border-slate-200 bg-slate-50/70 hover:border-brand-navy/30 hover:bg-white'
                            }`}
                        >
                          <div className="flex flex-row-reverse items-start gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selectedRole === 'user' ? 'bg-brand-navy text-white' : 'bg-white text-slate-400'}`}>
                              <i className="fa-solid fa-user" />
                            </div>
                            <div>
                              <p className={`text-sm font-black ${selectedRole === 'user' ? 'text-brand-navy' : 'text-slate-700'}`}>عميل</p>
                              <p className="mt-1 text-xs font-bold leading-6 text-slate-500">للحصول على استشارة، متابعة قضية، أو مراسلة محامٍ.</p>
                            </div>
                          </div>
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedRole('pro')}
                          className={`rounded-[1.4rem] border px-4 py-4 text-right transition ${selectedRole === 'pro'
                            ? 'border-brand-navy bg-brand-navy/5 shadow-[0_14px_30px_-24px_rgba(26,35,126,0.75)]'
                            : 'border-slate-200 bg-slate-50/70 hover:border-brand-navy/30 hover:bg-white'
                            }`}
                        >
                          <div className="flex flex-row-reverse items-start gap-3">
                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${selectedRole === 'pro' ? 'bg-brand-navy text-white' : 'bg-white text-slate-400'}`}>
                              <i className="fa-solid fa-user-tie" />
                            </div>
                            <div>
                              <p className={`text-sm font-black ${selectedRole === 'pro' ? 'text-brand-navy' : 'text-slate-700'}`}>محامي</p>
                              <p className="mt-1 text-xs font-bold leading-6 text-slate-500">لإدارة القضايا، استقبال العملاء، وتقديم خدمات قانونية.</p>
                            </div>
                          </div>
                        </button>
                      </div>
                    </div>

                    <div className="rounded-[1.3rem] border border-brand-gold/20 bg-brand-gold/10 px-4 py-3 text-right">
                      <p className="text-xs font-black text-brand-dark">نقطة مهمة</p>
                      <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                        {selectedRole === 'pro'
                          ? 'حساب المحامي يبدأ فوراً، وقد تحتاج لاحقاً إلى بيانات الترخيص لتفعيل الظهور واستقبال العملاء.'
                          : 'استخدم بريداً فعّالاً حتى نتمكن من إرسال الإشعارات أو تعليمات استعادة الحساب عند الحاجة.'}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-4">
                      <div className="mb-3 flex items-center justify-between text-[11px] font-black">
                        <span className="text-brand-navy">{registerChecklist.filter((item) => item.met).length}/{registerChecklist.length}</span>
                        <span className="text-slate-500">جاهزية الحساب</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {registerChecklist.map((item) => (
                          <div key={item.label} className={`flex flex-row-reverse items-center justify-end gap-2 rounded-xl px-3 py-2 text-[11px] font-bold ${item.met ? 'bg-emerald-50 text-emerald-700' : 'bg-white text-slate-500'}`}>
                            <span>{item.label}</span>
                            <i className={`fa-solid ${item.met ? 'fa-circle-check' : 'fa-circle'} text-[12px]`} />
                          </div>
                        ))}
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmitRegister}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-brand-navy px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-[#10284a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-user-plus" />
                        فتح الحساب
                      </span>
                    </button>
                    <p className="text-center text-[11px] font-bold text-slate-500">{destinationPreview}</p>
                  </motion.form>
                ) : (
                  <motion.form
                    key="login"
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    onSubmit={handleLogin}
                    className="space-y-4"
                  >
                    {recentAccounts.length > 0 && (
                      <div className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-black text-emerald-700">آمن</span>
                          <span className="text-[11px] font-black text-brand-navy">العودة لحساب محفوظ</span>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {recentAccounts.map((account) => (
                            <div
                              key={account.email}
                              className="group relative overflow-hidden rounded-lg border border-slate-200 bg-white p-2 transition hover:border-brand-navy/25 hover:shadow-md"
                            >
                              <span className="absolute inset-y-0 right-0 w-1 bg-brand-navy opacity-0 transition group-hover:opacity-100" />
                              <button
                                type="button"
                                onClick={() => forgetRecentAccount(account.email)}
                                className="absolute left-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white text-slate-300 shadow-sm transition hover:bg-rose-50 hover:text-rose-500"
                                aria-label={`إزالة ${account.name} من الحسابات المحفوظة`}
                              >
                                <i className="fa-solid fa-xmark text-xs" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRecentAccountSelect(account)}
                                className="flex w-full flex-row-reverse items-center gap-3 rounded-xl px-2 py-2 text-right"
                              >
                                {account.img ? (
                                  <img
                                    src={account.img}
                                    alt=""
                                    className="h-12 w-12 shrink-0 rounded-2xl object-cover ring-2 ring-white"
                                  />
                                ) : (
                                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-navy text-sm font-black text-white ring-2 ring-white">
                                    {getAccountInitials(account)}
                                  </span>
                                )}
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-black text-slate-800">{account.name}</span>
                                  <span className="mt-0.5 block truncate text-[11px] font-bold text-slate-500" dir="ltr">{account.email}</span>
                                  <span className="mt-1 inline-flex rounded-full bg-brand-navy/5 px-2 py-1 text-[10px] font-black text-brand-navy">
                                    {getRoleLabel(account.role)}
                                  </span>
                                </span>
                              </button>
                            </div>
                          ))}
                        </div>
                        <p className="mt-3 text-right text-[11px] font-bold leading-6 text-slate-500">
                          نحفظ الحساب فقط على هذا الجهاز لتسريع الرجوع، وكلمة المرور لا يتم حفظها.
                        </p>
                      </div>
                    )}

                    <div className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-[10px] font-black text-slate-400">للتجربة السريعة</span>
                        <span className="text-[10px] font-black text-brand-navy">حسابات جاهزة</span>
                      </div>
                      <div className="grid gap-2 sm:grid-cols-3">
                        {DEMO_ACCOUNTS.map((demo) => (
                          <button
                            key={demo.email}
                            type="button"
                            onClick={() => handleDemoLogin(demo)}
                            className="rounded-md border border-slate-200 bg-white px-3 py-2 text-[11px] font-black text-slate-600 transition hover:border-brand-navy/30 hover:text-brand-navy"
                          >
                            <i className={`fa-solid ${demo.icon} ml-1.5`}></i>
                            {demo.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('email') ? 'text-rose-500' : 'text-slate-500'}`}>
                        البريد الإلكتروني أو رقم الموبايل
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="your@email.com أو 07xxxxxxxxx"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          onBlur={() => markFieldTouched('email')}
                          autoComplete="username"
                          required
                          dir="ltr"
                          className={`w-full rounded-md border px-4 py-3.5 text-left text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('email')
                            ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                            : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                            }`}
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-300">
                          <i className={`fa-solid ${phoneLooksValid && !emailLooksValid ? 'fa-mobile-screen-button' : 'fa-envelope'}`} />
                        </div>
                      </div>
                      {!getFieldError('email') && touchedFields.has('email') && email && (
                        <p className={`mt-2 text-right text-[11px] font-bold ${loginIdentifierLooksValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                          {loginIdentifierLooksValid ? 'بيانات الدخول تبدو سليمة.' : 'أدخل بريداً صحيحاً أو رقم موبايل صالحاً.'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('password') ? 'text-rose-500' : 'text-slate-500'}`}>
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <input
                          ref={passwordInputRef}
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={() => markFieldTouched('password')}
                          autoComplete="current-password"
                          required
                          className={`w-full rounded-md border pl-12 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-4 ${getFieldError('password')
                            ? 'border-rose-300 bg-rose-50/70 focus:border-rose-500 focus:ring-rose-500/10'
                            : 'border-slate-200 bg-slate-50/80 focus:border-brand-navy focus:ring-brand-navy/10'
                            }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          className="absolute inset-y-0 left-3 flex items-center rounded-xl px-2 text-slate-400 transition hover:text-brand-navy"
                          aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                        >
                          <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'}`} />
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-slate-100 bg-white px-4 py-3">
                      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold text-slate-600">
                        <input
                          type="checkbox"
                          checked={rememberMe}
                          onChange={(e) => handleRememberMeChange(e.target.checked)}
                          className="h-4 w-4 rounded accent-brand-navy"
                        />
                        تذكرني على هذا الجهاز
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowForgotPassword(true)}
                        className="text-xs font-black text-brand-navy transition hover:text-brand-dark hover:underline"
                      >
                        هل نسيت كلمة المرور؟
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={!canSubmitLogin}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-md bg-brand-navy px-4 py-3.5 text-sm font-black text-white shadow-sm transition hover:bg-[#10284a] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-right-to-bracket" />
                        دخول للمنصة
                      </span>
                    </button>
                    <p className="text-center text-[11px] font-bold text-slate-500">{destinationPreview}</p>
                  </motion.form>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </section>
      </div>

      <AnimatePresence>
        {showForgotPassword && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-sm"
            onClick={() => setShowForgotPassword(false)}
          >
            <motion.div
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 text-right shadow-2xl"
            >
              <div className="flex items-start justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setShowForgotPassword(false)}
                  className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                >
                  <i className="fa-solid fa-xmark text-lg" />
                </button>
                <div className="flex-1">
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-navy/5 px-3 py-1.5 text-[11px] font-black text-brand-navy">
                    <i className="fa-solid fa-key text-[10px]" />
                    استعادة الوصول
                  </div>
                  <h3 className="mt-3 text-xl font-black text-brand-dark">إعادة تعيين كلمة المرور</h3>
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                    أدخل بريدك الإلكتروني لتسجيل طلب الاستعادة. إرسال الرابط الفعلي يحتاج تفعيل خدمة البريد في الخادم.
                  </p>
                </div>
              </div>

              <AnimatePresence>
                {forgotPasswordMessage && (
                  <motion.div
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className={`mt-5 rounded-[1.2rem] border px-4 py-3 ${forgotPasswordMessage.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}
                  >
                    <div className="flex flex-row-reverse items-start gap-3">
                      <i className={`fa-solid ${forgotPasswordMessage.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} mt-0.5`} />
                      <p className="text-sm font-bold leading-7">{forgotPasswordMessage.text}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleForgotPassword} className="mt-5 space-y-4">
                <div>
                  <label className="mb-2 block text-right text-[11px] font-black tracking-widest text-slate-500">
                    البريد الإلكتروني
                  </label>
                  <div className="relative">
                    <input
                      type="email"
                      placeholder="your@email.com"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      required
                      disabled={forgotPasswordLoading}
                      dir="ltr"
                      className="w-full rounded-[1.2rem] border border-slate-200 bg-slate-50/80 px-4 py-4 text-left text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/10 disabled:opacity-60"
                    />
                    <div className="pointer-events-none absolute inset-y-0 right-4 flex items-center text-slate-300">
                      <i className="fa-solid fa-envelope" />
                    </div>
                  </div>
                  {forgotEmail && !forgotPasswordMessage && (
                    <p className={`mt-2 text-right text-[11px] font-bold ${forgotEmailLooksValid ? 'text-emerald-600' : 'text-amber-600'}`}>
                      {forgotEmailLooksValid ? 'سيتم استخدام هذا البريد لإرسال رابط الاستعادة.' : 'تأكد من كتابة بريد إلكتروني صحيح.'}
                    </p>
                  )}
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setShowForgotPassword(false)}
                    disabled={forgotPasswordLoading}
                    className="flex-1 rounded-[1.2rem] border border-slate-200 px-4 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    إلغاء
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordLoading || !forgotEmailLooksValid}
                    className="flex-1 rounded-[1.2rem] bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] px-4 py-3 text-sm font-black text-white shadow-lg shadow-brand-navy/20 transition hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {forgotPasswordLoading ? (
                      <span className="flex items-center justify-center gap-2">
                        <motion.i
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                          className="fa-solid fa-spinner"
                        />
                        إرسال
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <i className="fa-solid fa-paper-plane" />
                        إرسال الرابط
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
