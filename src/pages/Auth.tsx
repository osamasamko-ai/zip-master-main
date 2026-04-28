import React, { useState, useMemo } from 'react';
import { useAuth, Role } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

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
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // تأثير المغناطيس للأزرار
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const handleMagnetMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.35;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.35;
    setMousePos({ x, y });
  };
  const resetMagnet = () => setMousePos({ x: 0, y: 0 });

  const resetRegisterFields = () => {
    setName('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSelectedRole('user');
  };

  const getFieldError = (fieldName: string) => {
    if (!error) return false;
    const lowerError = error.toLowerCase();
    const isLoginError = authMode === 'login' && (lowerError.includes('credentials') || lowerError.includes('failed') || error.includes('التحقق') || error.includes('خطأ'));

    if (fieldName === 'name') return error.includes('الاسم');
    if (fieldName === 'email') return error.includes('البريد') || isLoginError;
    if (fieldName === 'password') return (error.includes('كلمة المرور') && !error.includes('تأكيد')) || isLoginError;
    if (fieldName === 'confirmPassword') return error.includes('تأكيد');
    return false;
  };

  const passwordStrength = useMemo(() => {
    let score = 0;
    if (!password) return 0;
    if (password.length >= 8) score += 1;
    if (/[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    return score;
  }, [password]);

  const getStrengthUI = () => {
    const labels = ['ضعيفة جداً', 'ضعيفة', 'متوسطة', 'قوية', 'قوية جداً'];
    const colors = ['bg-slate-200', 'bg-red-500', 'bg-amber-500', 'bg-emerald-500', 'bg-blue-500'];
    return { label: labels[passwordStrength], color: colors[passwordStrength] };
  };

  const normalizeEmail = (value: string) => value.trim().toLowerCase();

  const validateRegisterForm = () => {
    const trimmedName = name.trim();
    const normalizedEmail = normalizeEmail(email);

    if (!trimmedName) {
      return 'يرجى إدخال الاسم الكامل.';
    }

    if (!normalizedEmail) {
      return 'يرجى إدخال البريد الإلكتروني.';
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return 'صيغة البريد الإلكتروني غير صحيحة.';
    }

    if (password.length < 8) {
      return 'كلمة المرور يجب أن تكون 8 أحرف على الأقل.';
    }

    if (password !== confirmPassword) {
      return 'تأكيد كلمة المرور غير مطابق.';
    }

    return null;
  };

  // تحسينات الحركة للنقاط الأساسية
  const brandingContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.15,
        delayChildren: 0.2,
      },
    },
  };

  const brandingItemVariants = {
    hidden: { opacity: 0, x: 40 },
    visible: {
      opacity: 1,
      x: 0,
      transition: { duration: 0.6 }
    },
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

  return (
    <div className="relative z-[200] flex min-h-screen flex-col lg:flex-row bg-white fade-in overflow-x-hidden">
      {/* Branding Side: Premium Hero & Background Effects */}
      <div className="flex w-full lg:w-1/2 bg-[linear-gradient(165deg,#060b19_0%,#0d1428_40%,#1B365D_100%)] relative flex-col items-center justify-center text-white text-center px-6 py-16 lg:px-12 overflow-hidden min-h-[500px] lg:min-h-screen">
        {/* Animated Background Blobs */}
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 10, 0],
            opacity: [0.1, 0.15, 0.1]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
          className="absolute -top-32 -left-32 w-[600px] h-[600px] bg-brand-gold blur-[140px] rounded-full pointer-events-none"
        />
        <motion.div
          animate={{
            scale: [1, 1.3, 1],
            x: [0, 40, 0],
            opacity: [0.2, 0.4, 0.2]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/2 right-0 w-[500px] h-[500px] bg-brand-navy blur-[120px] rounded-full translate-x-1/2 pointer-events-none"
        />

        {/* Particle System */}
        {[...Array(6)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{
              y: [0, -60, 0],
              opacity: [0, 0.4, 0],
              scale: [0.8, 1.2, 0.8]
            }}
            transition={{
              duration: 5 + i * 1.5,
              repeat: Infinity,
              delay: i * 0.5,
              ease: "easeInOut"
            }}
            className="absolute w-1 h-1 bg-brand-gold/30 rounded-full blur-[0.5px]"
            style={{
              top: `${Math.random() * 90}%`,
              left: `${Math.random() * 90}%`
            }}
          />
        ))}

        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.02)_0%,transparent_60%)]"></div>
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-[0.03] mix-blend-overlay"></div>

        <motion.div
          variants={brandingContainerVariants}
          initial="hidden"
          animate="visible"
          className="max-w-lg relative z-10"
        >
          <motion.h2 variants={brandingItemVariants} className="text-3xl lg:text-4xl font-black mb-6 leading-tight text-center">حقك القانوني.. بوضوح واحترافية</motion.h2>

          <motion.p variants={brandingItemVariants} className="mb-10 text-gray-200 text-base lg:text-lg font-bold leading-relaxed text-center opacity-90 px-4">
            القسطاس: دمج الخبرة القانونية بالذكاء الاصطناعي لعدالة رقمية سريعة وموثوقة.
          </motion.p>

          <div className="mb-12 px-4">
            <motion.p variants={brandingItemVariants} className="text-lg lg:text-xl font-black mb-8 text-brand-gold text-right">لماذا القسطاس؟</motion.p>

            <div className="space-y-6 flex flex-col items-end">
              {[
                "نخبة المحامين المعتمدين",
                "شفافية مطلقة في تتبع قضيتك",
                "حلول ذكية بمراجع قانونية دقيقة"
              ].map((text, idx) => (
                <motion.div key={idx} variants={brandingItemVariants} className="flex flex-row-reverse items-center gap-5 text-right w-full">
                  <p className="font-bold text-base lg:text-lg text-right">{text}</p>
                  <div className="w-10 h-10 rounded-2xl bg-brand-gold/20 flex items-center justify-center shrink-0 shadow-sm border border-brand-gold/10">
                    <i className="fa-solid fa-check text-brand-gold"></i>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>

          <motion.div variants={brandingItemVariants} className="mx-4 rounded-[2rem] lg:rounded-[2.5rem] bg-white/5 border border-white/10 p-6 lg:p-8 mb-12 backdrop-blur-md text-center shadow-2xl">
            <p className="text-lg lg:text-xl font-black text-brand-gold mb-6 border-b border-white/10 pb-6 ">نضمن حقك.. دائماً</p>
            <div className="space-y-4 text-sm lg:text-base font-bold text-gray-100 ">
              <div className="flex flex-row-reverse items-center gap-4 ">
                <p>استرداد كامل الأتعاب عند أي تقصير</p>
                <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0 shadow-gold-glow">
                  <i className="fa-solid fa-shield-halved text-brand-gold text-sm"></i>
                </div>
              </div>
              <div className="flex flex-row-reverse items-center gap-4 ">
                <p>بديل فوري لضمان استمرار دعواك</p>
                <div className="w-8 h-8 rounded-full bg-brand-gold/15 flex items-center justify-center shrink-0 shadow-gold-glow">
                  <i className="fa-solid fa-user-tie text-brand-gold text-sm"></i>
                </div>
              </div>
            </div>
          </motion.div>

          <motion.div variants={brandingItemVariants} className="mx-4 space-y-4 mt-8 p-8 lg:p-10 rounded-[2.5rem] lg:rounded-[3rem] bg-white/[0.02] border border-white/5 backdrop-blur-sm shadow-inner relative overflow-hidden group transition-all duration-500 hover:bg-white/[0.04]">
            <div className="absolute -right-20 -bottom-20 w-48 h-48 bg-brand-gold/10 blur-[90px] rounded-full group-hover:bg-brand-gold/20 transition-all duration-700"></div>
            <p className="text-lg lg:text-xl font-bold text-gray-100 relative z-10">استعد حقوقك الآن</p>
            <h3 className="text-3xl lg:text-5xl font-black text-brand-gold tracking-tighter mt-2 relative z-10 drop-shadow-2xl">العدالة.. في متناول يدك</h3>
          </motion.div>
        </motion.div>
      </div>

      {/* Right Side: Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:px-24 lg:w-1/2 lg:py-0">
        <div className="max-w-md w-full mx-auto">
          <div className="hidden lg:flex flex-row items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] rounded-xl flex items-center justify-center text-brand-gold shadow-gold-glow">
              <i className="fa-solid fa-scale-balanced text-2xl"></i>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black leading-none text-brand-dark tracking-tight">القسطاس</h1>
              <p className="text-xs font-bold text-slate-400 mt-1 tracking-tight">عدالة رقمية. خبرة قانونية. ذكاء اصطناعي.</p>
            </div>
          </div>

          <div className="mb-8 flex flex-row border-b border-slate-100">
            <button
              onClick={() => {
                setError(null);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setAuthMode('login');
              }}
              className={`relative flex-1 pb-4 text-center text-sm font-black transition-colors duration-300 ${authMode === 'login' ? 'text-brand-navy' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              تسجيل الدخول
              {authMode === 'login' && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-navy" />
              )}
            </button>
            <button
              onClick={() => {
                setError(null);
                setShowPassword(false);
                setShowConfirmPassword(false);
                setAuthMode('register');
              }}
              className={`relative flex-1 pb-4 text-center text-sm font-black transition-colors duration-300 ${authMode === 'register' ? 'text-brand-navy' : 'text-slate-400 hover:text-slate-600'
                }`}
            >
              حساب جديد
              {authMode === 'register' && (
                <motion.div layoutId="authTab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-brand-navy" />
              )}
            </button>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                key={error}
                initial={{ x: 0, opacity: 0 }}
                animate={{ x: [0, -10, 10, -10, 10, 0], opacity: 1 }}
                transition={{ duration: 0.4 }}
                exit={{ opacity: 0 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-xs font-bold leading-relaxed text-right"
              >
                {error}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="loading-skeleton"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 py-4"
              >
                {[1, 2, 3].map((i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 w-24 bg-slate-100 rounded-full ml-auto" />
                    <div className="h-12 w-full bg-slate-50 border border-slate-100 rounded-2xl animate-pulse" />
                  </div>
                ))}
                <div className="h-14 w-full bg-slate-200 rounded-2xl mt-4 animate-pulse" />
                <div className="flex flex-col items-center gap-4 pt-8">
                  <div className="relative w-12 h-12">
                    <div className="absolute inset-0 border-4 border-brand-navy/5 rounded-full" />
                    <div className="absolute inset-0 border-4 border-t-brand-navy rounded-full animate-spin" />
                  </div>
                  <p className="text-[11px] font-black text-brand-navy/60 uppercase tracking-widest animate-pulse text-center">جاري تحضير مساحتك القانونية الآمنة...</p>
                </div>
              </motion.div>
            ) : authMode === 'login' ? (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleLogin}
                className="space-y-5"
              >
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('email') ? 'text-red-500' : 'text-slate-400'}`}>البريد الإلكتروني</label>
                  <motion.div animate={getFieldError('email') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`w-full rounded-2xl border px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('email') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                        }`}
                      dir="ltr"
                    />
                  </motion.div>
                  {getFieldError('email') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('password') ? 'text-red-500' : 'text-slate-400'}`}>كلمة المرور</label>
                  <motion.div animate={getFieldError('password') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('password') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-navy transition-colors p-1"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </motion.div>
                  {getFieldError('password') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <motion.button
                  type="submit"
                  onMouseMove={handleMagnetMove}
                  onMouseLeave={resetMagnet}
                  animate={{ x: mousePos.x, y: mousePos.y }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  دخول للمنصة
                </motion.button>
              </motion.form>
            ) : (
              <motion.form
                key="register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                onSubmit={handleRegister}
                className="space-y-5"
              >
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('name') ? 'text-red-500' : 'text-slate-400'}`}>الاسم الكامل</label>
                  <motion.div animate={getFieldError('name') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input
                      type="text"
                      placeholder="اسمك الكامل"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={`w-full rounded-2xl border px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('name') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                        }`}
                    />
                  </motion.div>
                  {getFieldError('name') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('email') ? 'text-red-500' : 'text-slate-400'}`}>البريد الإلكتروني</label>
                  <motion.div animate={getFieldError('email') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className={`w-full rounded-2xl border px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('email') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                        }`}
                      dir="ltr"
                    />
                  </motion.div>
                  {getFieldError('email') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('password') ? 'text-red-500' : 'text-slate-400'}`}>كلمة المرور</label>
                  <motion.div animate={getFieldError('password') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('password') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-navy transition-colors p-1"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </motion.div>
                  {password && (
                    <div className="mt-2 space-y-2 px-1">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className={passwordStrength === 4 ? 'text-blue-600' : 'text-slate-400'}>
                          {getStrengthUI().label}
                        </span>
                        <span className="text-slate-400">قوة كلمة المرور</span>
                      </div>
                      <div className="flex h-1 gap-1 overflow-hidden rounded-full bg-slate-100">
                        {[1, 2, 3, 4].map((step) => (
                          <div key={step} className={`h-full flex-1 transition-all duration-500 ${passwordStrength >= step ? getStrengthUI().color : 'bg-transparent'}`} />
                        ))}
                      </div>
                    </div>
                  )}
                  {getFieldError('password') ? (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  ) : (
                    <p className="mt-2 text-right text-[10px] font-bold text-slate-400">يجب أن تتكون من 8 أحرف أو رموز على الأقل.</p>
                  )}
                </div>
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('confirmPassword') ? 'text-red-500' : 'text-slate-400'}`}>تأكيد كلمة المرور</label>
                  <motion.div animate={getFieldError('confirmPassword') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <div className="relative">
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        className={`w-full rounded-2xl border pl-16 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('confirmPassword') || (confirmPassword !== '' && password !== confirmPassword)
                          ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10'
                          : (confirmPassword !== '' && password === confirmPassword)
                            ? 'border-emerald-200 bg-emerald-50/30 focus:border-emerald-500 focus:ring-emerald-500/10'
                            : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                          }`}
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        <AnimatePresence mode="wait">
                          {confirmPassword !== '' && (
                            <motion.i
                              key={password === confirmPassword ? 'match' : 'mismatch'}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className={`fa-solid ${password === confirmPassword ? 'fa-circle-check text-emerald-500' : 'fa-circle-xmark text-red-500'} text-xs`}
                            />
                          )}
                        </AnimatePresence>
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-slate-400 hover:text-brand-navy transition-colors p-1"
                        >
                          <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                        </button>
                      </div>
                    </div>
                  </motion.div>
                  {getFieldError('confirmPassword') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500"
                    >
                      {error}
                    </motion.p>
                  )}
                </div>
                <div>
                  <label className="mb-3 block text-right text-[11px] font-black uppercase tracking-widest text-slate-400">نوع الحساب</label>
                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole('user')}
                      className={`p-4 rounded-3xl border-2 transition-all text-right flex flex-col gap-2 ${selectedRole === 'user' ? 'border-brand-navy bg-brand-navy/5 shadow-md ring-4 ring-brand-navy/5' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedRole === 'user' ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/30' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}>
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div>
                        <p className={`text-xs font-black ${selectedRole === 'user' ? 'text-brand-navy' : 'text-slate-700'}`}>عميل</p>
                        <p className="text-[10px] font-bold text-slate-400">أبحث عن استشارة</p>
                      </div>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole('pro')}
                      className={`p-4 rounded-3xl border-2 transition-all text-right flex flex-col gap-2 ${selectedRole === 'pro' ? 'border-brand-navy bg-brand-navy/5 shadow-md ring-4 ring-brand-navy/5' : 'border-slate-100 bg-slate-50 hover:border-slate-200'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${selectedRole === 'pro' ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/30' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}>
                        <i className="fa-solid fa-user-tie"></i>
                      </div>
                      <div>
                        <p className={`text-xs font-black ${selectedRole === 'pro' ? 'text-brand-navy' : 'text-slate-700'}`}>محامي</p>
                        <p className="text-[10px] font-bold text-slate-400">تقديم خدمات قانونية</p>
                      </div>
                    </motion.button>
                  </div>
                </div>
                <motion.button
                  type="submit"
                  onMouseMove={handleMagnetMove}
                  onMouseLeave={resetMagnet}
                  animate={{ x: mousePos.x, y: mousePos.y }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  فتح حساب جديد
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
