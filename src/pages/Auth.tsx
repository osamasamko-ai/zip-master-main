import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Role, useAuth } from '../context/AuthContext';

const HERO_PARTICLES = [
  { top: '14%', left: '18%', size: 'h-2 w-2', delay: 0.2, duration: 7 },
  { top: '24%', left: '72%', size: 'h-1.5 w-1.5', delay: 0.8, duration: 6.4 },
  { top: '42%', left: '16%', size: 'h-2.5 w-2.5', delay: 1.2, duration: 8.1 },
  { top: '58%', left: '80%', size: 'h-1 w-1', delay: 0.4, duration: 5.8 },
  { top: '74%', left: '26%', size: 'h-2 w-2', delay: 1.6, duration: 7.5 },
  { top: '82%', left: '62%', size: 'h-1.5 w-1.5', delay: 0.9, duration: 6.8 },
];

const VALUE_POINTS = [
  'محامون يفهمون الواقع القانوني العراقي.',
  'متابعة أوضح للقضية والمستندات.',
  'تواصل أسرع وأكثر مهنية.',
];

const TRUST_SIGNALS = [
  { icon: 'fa-landmark', title: 'للقانون العراقي', text: 'خدمات رقمية تناسب طبيعة السوق والإجراءات.' },
  { icon: 'fa-file-signature', title: 'تنظيم أفضل', text: 'ملفاتك ورسائلك في مساحة واحدة واضحة.' },
  { icon: 'fa-user-shield', title: 'ثقة أعلى', text: 'خصوصية مهنية وتجربة أكثر اطمئناناً.' },
];

const PASSWORD_HINTS = [
  { key: 'minLength', text: '8 أحرف على الأقل' },
  { key: 'hasUpperCase', text: 'حرف كبير واحد على الأقل' },
  { key: 'hasNumber', text: 'رقم واحد على الأقل' },
  { key: 'hasSpecial', text: 'رمز خاص واحد على الأقل' },
] as const;

type PasswordRequirementKey = (typeof PASSWORD_HINTS)[number]['key'];

const authPanelVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' } },
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
  const { login, register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const isRegisterMode = authMode === 'register';

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

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
  const forgotEmailPreview = normalizeEmail(forgotEmail);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailPreview);
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

  const getFieldError = (fieldName: string) => {
    if (!error) return false;

    const lowerError = error.toLowerCase();
    const isLoginError =
      authMode === 'login' &&
      (lowerError.includes('credentials') ||
        lowerError.includes('failed') ||
        error.includes('التحقق') ||
        error.includes('خطأ'));

    if (fieldName === 'name') return error.includes('الاسم');
    if (fieldName === 'email') return error.includes('البريد') || isLoginError;
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
      const loggedInUser = await login(normalizeEmail(email), password);
      navigate(loggedInUser.role === 'admin' ? '/admin' : loggedInUser.role === 'pro' ? '/pro' : '/user');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
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
      resetRegisterFields();
      navigate(registeredUser.role === 'admin' ? '/admin' : registeredUser.role === 'pro' ? '/pro' : '/user');
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
        text: `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${forgotEmailPreview}. يرجى التحقق من بريدك الإلكتروني.`,
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
    <div className="relative min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7f2e8_0%,#edf3fb_44%,#f8fbff_100%)]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(197,160,89,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(27,54,93,0.12),transparent_32%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1600px] flex-col lg:flex-row">
        <section className="relative flex w-full overflow-hidden px-6 py-12 sm:px-8 lg:w-[54%] lg:px-12 lg:py-16">
          <div className="absolute inset-0 bg-[linear-gradient(160deg,#091224_0%,#0c1730_38%,#16345c_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.08),transparent_32%)]" />
          <div className="absolute -left-24 top-12 h-72 w-72 rounded-full bg-brand-gold/20 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-80 w-80 translate-x-20 translate-y-12 rounded-full bg-sky-400/10 blur-3xl" />

          {HERO_PARTICLES.map((particle, index) => (
            <motion.span
              key={index}
              className={`absolute ${particle.size} rounded-full bg-white/40`}
              style={{ top: particle.top, left: particle.left }}
              animate={{ y: [0, -18, 0], opacity: [0.15, 0.55, 0.15], scale: [1, 1.15, 1] }}
              transition={{
                duration: particle.duration,
                delay: particle.delay,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}

          <div className="relative z-10 flex w-full flex-col justify-center gap-10 lg:gap-12">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="flex items-center justify-between"
            >
              <div className="inline-flex items-center gap-3 rounded-2xl border border-white/12 bg-white/8 px-4 py-3 backdrop-blur-xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-brand-gold shadow-gold-glow">
                  <i className="fa-solid fa-scale-balanced text-2xl" />
                </div>
                <div className="text-right text-white">
                  <p className="text-lg font-black leading-none">القسطاس</p>
                  <p className="mt-1 text-[11px] font-bold text-slate-300">منصة قانونية عراقية رقمية</p>
                </div>
              </div>
              <div className="hidden rounded-full border border-white/10 bg-white/8 px-4 py-2 text-xs font-bold text-slate-200 backdrop-blur-xl md:flex md:items-center md:gap-2">
                <span className="inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
                مصممة لاحتياجات القانون العراقي
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="max-w-xl text-right text-white"
            >
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-gold/30 bg-brand-gold/10 px-4 py-2 text-[11px] font-black text-brand-lightgold backdrop-blur">
                <i className="fa-solid fa-sparkles text-[10px]" />
                منصة ذكية لخدمات قانونية تناسب الواقع العراقي
              </div>
              <h1 className="max-w-lg text-3xl font-black leading-[1.15] sm:text-4xl lg:text-[3.1rem]">
                خدمات قانونية عراقية
                <span className="mt-2 block text-brand-gold">تنظيم أدق، تواصل أسهل، ومتابعة أوضح.</span>
              </h1>
              <p className="mt-5 max-w-md text-sm font-bold leading-7 text-slate-200 sm:text-[15px]">
                القسطاس تسهّل الاستشارة، تنظيم الملفات، ومتابعة القضية داخل تجربة رقمية مصممة للمستخدم العراقي.
              </p>
            </motion.div>

            <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)] xl:items-start">
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.12 }}
                className="rounded-[2rem] border border-white/12 bg-white/8 p-6 text-right shadow-2xl backdrop-blur-2xl"
              >
                <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
                  <p className="text-xs font-black text-brand-lightgold">لماذا القسطاس؟</p>
                  <p className="text-[11px] font-bold text-slate-300">مزايا عملية مباشرة</p>
                </div>
                <div className="mt-5 space-y-4">
                  {VALUE_POINTS.map((point, index) => (
                    <div key={point} className="flex flex-row-reverse items-start gap-4 rounded-[1.4rem] border border-white/8 bg-white/[0.03] px-4 py-4">
                      <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-brand-gold/16 text-brand-gold">
                        <span className="text-sm font-black">{index + 1}</span>
                      </div>
                      <p className="pt-1 text-sm font-bold leading-6 text-slate-100">{point}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.18 }}
                className="grid gap-3"
              >
                {TRUST_SIGNALS.map((item) => (
                  <div
                    key={item.title}
                    className="rounded-[1.6rem] border border-white/10 bg-slate-950/20 p-5 text-right backdrop-blur-xl"
                  >
                    <div className="flex flex-row-reverse items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-brand-gold">
                        <i className={`fa-solid ${item.icon}`} />
                      </div>
                      <div className="pt-0.5">
                        <p className="text-[13px] font-black text-white">{item.title}</p>
                        <p className="mt-1 text-[11px] font-bold leading-5 text-slate-300">{item.text}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </motion.div>
            </div>
          </div>
        </section>

        <section className="relative flex w-full items-center justify-center px-5 py-8 sm:px-8 sm:py-10 lg:w-[46%] lg:px-10 lg:py-14">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.08 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_30px_90px_-45px_rgba(15,23,42,0.45)] backdrop-blur-2xl sm:p-6 lg:p-7"
          >
            <div className="rounded-[1.6rem] border border-slate-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(248,250,252,0.92)_100%)] p-5 sm:p-6">
              <div className="mb-6 flex items-start justify-between gap-4">
                <div className="text-right">
                  <div className="inline-flex items-center gap-2 rounded-full bg-brand-navy/5 px-3 py-1.5 text-[11px] font-black text-brand-navy">
                    <i className={`fa-solid ${isRegisterMode ? 'fa-user-plus' : 'fa-right-to-bracket'} text-[10px]`} />
                    {isRegisterMode ? 'فتح حساب جديد' : 'تسجيل الدخول'}
                  </div>
                  <h2 className="mt-3 text-2xl font-black text-brand-dark sm:text-[2rem]">
                    {isRegisterMode ? 'ابدأ رحلتك القانونية الآن' : 'مرحباً بعودتك'}
                  </h2>
                  <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
                    {isRegisterMode
                      ? 'أدخل بياناتك مرة واحدة، وسنجهز لك مساحة تناسب دورك مباشرة.'
                      : 'سجّل دخولك بسرعة، ثم تابع قضاياك ورسائلك من نفس المكان.'}
                  </p>
                </div>
                <div className="hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] text-brand-gold shadow-xl shadow-brand-navy/15 sm:flex">
                  <i className={`fa-solid ${isRegisterMode ? 'fa-user-shield' : 'fa-fingerprint'} text-xl`} />
                </div>
              </div>

              <div className="mb-6 rounded-[1.4rem] bg-slate-100/80 p-1">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`relative rounded-[1.1rem] px-4 py-3 text-sm font-black transition ${!isRegisterMode ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {!isRegisterMode && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        className="absolute inset-0 rounded-[1.1rem] bg-white shadow-sm"
                      />
                    )}
                    <span className="relative z-10">تسجيل الدخول</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`relative rounded-[1.1rem] px-4 py-3 text-sm font-black transition ${isRegisterMode ? 'text-brand-navy' : 'text-slate-500 hover:text-slate-700'
                      }`}
                  >
                    {isRegisterMode && (
                      <motion.span
                        layoutId="auth-mode-pill"
                        className="absolute inset-0 rounded-[1.1rem] bg-white shadow-sm"
                      />
                    )}
                    <span className="relative z-10">حساب جديد</span>
                  </button>
                </div>
              </div>

              <AnimatePresence mode="wait">
                {error && (
                  <motion.div
                    key={error}
                    variants={authPanelVariants}
                    initial="hidden"
                    animate="visible"
                    exit="exit"
                    className="mb-5 flex items-start gap-3 rounded-[1.3rem] border border-rose-200 bg-rose-50 px-4 py-3 text-right"
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

              <AnimatePresence mode="wait">
                {loading ? (
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
                        استخدم بريداً فعّالاً حتى نتمكن من إرسال الإشعارات أو تعليمات استعادة الحساب عند الحاجة.
                      </p>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[1.3rem] bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] px-4 py-4 text-sm font-black text-white shadow-xl shadow-brand-navy/20 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-brand-navy/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,0.24)_50%,transparent_85%)] opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
                      <span className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-user-plus" />
                        فتح الحساب
                      </span>
                    </button>
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
                    <div className="rounded-[1.35rem] border border-brand-navy/10 bg-brand-navy/[0.03] px-4 py-3 text-right">
                      <p className="text-xs font-black text-brand-navy">تسجيل أسرع وأوضح</p>
                      <p className="mt-1 text-xs font-bold leading-6 text-slate-600">
                        أدخل بريدك وكلمة المرور، وسنعيدك مباشرة إلى لوحة التحكم المناسبة لدورك.
                      </p>
                    </div>

                    <div>
                      <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('email') ? 'text-rose-500' : 'text-slate-500'}`}>
                        البريد الإلكتروني
                      </label>
                      <div className="relative">
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          onChange={(e) => handleEmailChange(e.target.value)}
                          onBlur={() => markFieldTouched('email')}
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
                          {emailLooksValid ? 'صيغة البريد تبدو سليمة.' : 'قد تحتاج إلى مراجعة صيغة البريد الإلكتروني.'}
                        </p>
                      )}
                    </div>

                    <div>
                      <label className={`mb-2 block text-right text-[11px] font-black tracking-widest ${getFieldError('password') ? 'text-rose-500' : 'text-slate-500'}`}>
                        كلمة المرور
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          onBlur={() => markFieldTouched('password')}
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
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[1.2rem] bg-slate-50/80 px-4 py-3">
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
                      disabled={loading}
                      className="group relative flex w-full items-center justify-center gap-2 overflow-hidden rounded-[1.3rem] bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] px-4 py-4 text-sm font-black text-white shadow-xl shadow-brand-navy/20 transition hover:-translate-y-0.5 hover:shadow-2xl hover:shadow-brand-navy/25 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <span className="absolute inset-0 bg-[linear-gradient(120deg,transparent_15%,rgba(255,255,255,0.24)_50%,transparent_85%)] opacity-0 transition group-hover:translate-x-full group-hover:opacity-100" />
                      <span className="relative z-10 flex items-center gap-2">
                        <i className="fa-solid fa-right-to-bracket" />
                        دخول للمنصة
                      </span>
                    </button>
                  </motion.form>
                )}
              </AnimatePresence>

              {/* Verification Section for both Login and Register */}
              <motion.div key="verify-section" variants={authPanelVariants} initial="hidden" animate="visible" exit="exit" className="mt-6 pt-6 border-t border-slate-100 text-center">
                <label className="mb-3 block text-right text-[11px] font-black tracking-widest text-slate-500">
                  التحقق من مستند رقمي
                </label>
                <div className="relative mb-4">
                  <input
                    type="text"
                    placeholder="أدخل رقم المستند (ID)"
                    value={documentIdInput}
                    onChange={(e) => setDocumentIdInput(e.target.value)}
                    className="w-full rounded-[1.2rem] border px-4 py-4 text-right text-sm font-bold text-slate-700 outline-none transition placeholder:text-slate-400 focus:bg-white focus:border-brand-navy focus:ring-4 focus:ring-brand-navy/10"
                  />
                  <div className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-300">
                    <i className="fa-solid fa-qrcode" />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate(`/verify/${documentIdInput}`)}
                  disabled={!documentIdInput.trim()}
                  className="text-xs font-black text-brand-navy transition hover:text-brand-dark hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  التحقق من مستند رقمي (بدون تسجيل دخول)
                </button>
              </motion.div>
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
                    أدخل بريدك الإلكتروني وسنرسل لك رابطاً لمتابعة استعادة الحساب.
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
