import React, { useState, useMemo, useEffect } from 'react';
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
  const [rememberMe, setRememberMe] = useState(false);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const [forgotPasswordMessage, setForgotPasswordMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  // Load saved email on component mount
  useEffect(() => {
    const savedEmail = localStorage.getItem('rememberedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

  const handleFieldTouch = (fieldName: string) => {
    setTouchedFields(prev => new Set([...prev, fieldName]));
  };

  // Handle remember me functionality
  const handleRememberMeChange = (checked: boolean) => {
    setRememberMe(checked);
    if (checked && email) {
      localStorage.setItem('rememberedEmail', email);
    } else {
      localStorage.removeItem('rememberedEmail');
    }
  };

  // Handle email change and update localStorage if remember me is checked
  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (rememberMe) {
      localStorage.setItem('rememberedEmail', value);
    }
  };

  // Handle forgot password
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotPasswordLoading(true);
    setForgotPasswordMessage(null);

    try {
      // TODO: Replace with actual API call to your backend
      // For now, we'll simulate the request
      await new Promise(resolve => setTimeout(resolve, 1500));

      setForgotPasswordMessage({
        type: 'success',
        text: `تم إرسال رابط إعادة تعيين كلمة المرور إلى ${forgotEmail}. يرجى التحقق من بريدك الإلكتروني.`
      });

      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotEmail('');
        setForgotPasswordMessage(null);
      }, 3000);
    } catch (err: any) {
      setForgotPasswordMessage({
        type: 'error',
        text: 'فشل إرسال رابط إعادة التعيين. يرجى المحاولة مرة أخرى.'
      });
    } finally {
      setForgotPasswordLoading(false);
    }
  };

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

  const getPasswordRequirements = () => {
    return {
      minLength: password.length >= 8,
      hasUpperCase: /[A-Z]/.test(password),
      hasNumber: /\d/.test(password),
      hasSpecial: /[^A-Za-z0-9]/.test(password),
    };
  };

  const allRequirementsMet = () => {
    const req = getPasswordRequirements();
    return req.minLength && req.hasUpperCase && req.hasNumber && req.hasSpecial;
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
                initial={{ x: 0, opacity: 0, y: -10 }}
                animate={{ x: 0, opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl text-right flex gap-3 items-start"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <i className="fa-solid fa-circle-exclamation text-red-600 text-lg"></i>
                </div>
                <div>
                  <p className="text-red-700 text-xs font-bold leading-relaxed">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="flex-shrink-0 text-red-400 hover:text-red-600 transition-colors"
                >
                  <i className="fa-solid fa-xmark text-sm"></i>
                </button>
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
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => handleEmailChange(e.target.value)}
                      onBlur={() => handleFieldTouch('email')}
                      required
                      className={`w-full rounded-2xl border px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition-all duration-200 focus:bg-white outline-none focus:ring-4 shadow-inner placeholder:text-slate-400 ${getFieldError('email') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5 hover:border-slate-300'
                        }`}
                      dir="ltr"
                    />
                  </motion.div>
                  {getFieldError('email') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500 flex items-center justify-end gap-1"
                    >
                      <i className="fa-solid fa-times-circle"></i>
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
                        onBlur={() => handleFieldTouch('password')}
                        required
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 transition-all duration-200 focus:bg-white outline-none focus:ring-4 shadow-inner placeholder:text-slate-400 ${getFieldError('password') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5 hover:border-slate-300'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-navy transition-colors p-1 hover:bg-slate-100 rounded-lg"
                      >
                        <i className={`fa-solid ${showPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </motion.div>
                  {getFieldError('password') && (
                    <motion.p
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="mt-1.5 text-right text-[10px] font-black text-red-500 flex items-center justify-end gap-1"
                    >
                      <i className="fa-solid fa-times-circle"></i>
                      {error}
                    </motion.p>
                  )}
                </div>

                <div className="flex items-center justify-between pt-2">
                  <motion.label whileHover={{ scale: 1.02 }} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => handleRememberMeChange(e.target.checked)}
                      className="w-4 h-4 accent-brand-navy rounded cursor-pointer"
                    />
                    <span className="text-xs font-bold text-slate-600">تذكرني</span>
                  </motion.label>
                  <motion.button
                    type="button"
                    onClick={() => setShowForgotPassword(true)}
                    whileHover={{ scale: 1.05, color: '#1B365D' }}
                    whileTap={{ scale: 0.98 }}
                    className="text-xs font-bold text-slate-400 hover:text-brand-navy transition-colors relative group"
                  >
                    هل نسيت كلمة المرور؟
                    <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-brand-navy transition-all duration-300 group-hover:w-full"></span>
                  </motion.button>
                </div>
                <motion.button
                  type="submit"
                  disabled={loading}
                  onMouseMove={handleMagnetMove}
                  onMouseLeave={resetMagnet}
                  animate={{ x: mousePos.x, y: mousePos.y }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  whileHover={{ scale: 1.01, boxShadow: "0 0 25px rgba(197, 160, 89, 0.4)" }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all duration-300 hover:shadow-2xl hover:shadow-brand-navy/30 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:translate-y-0 relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <i className="fa-solid fa-sign-in-alt"></i>
                    دخول للمنصة
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform group-hover:translate-x-full transition-all duration-500" style={{ width: '100%' }}></div>
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
                    <div className="mt-3 space-y-3 px-1">
                      <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
                        <span className={passwordStrength === 4 ? 'text-blue-600' : 'text-slate-400'}>
                          {getStrengthUI().label}
                        </span>
                        <span className="text-slate-400">قوة كلمة المرور</span>
                      </div>
                      <div className="flex h-1.5 gap-1 overflow-hidden rounded-full bg-slate-100">
                        {[1, 2, 3, 4].map((step) => (
                          <motion.div
                            key={step}
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            className={`h-full flex-1 transition-all duration-500 origin-right rounded-full ${passwordStrength >= step ? getStrengthUI().color : 'bg-slate-200'}`}
                          />
                        ))}
                      </div>
                      {/* Password Requirements Checklist */}
                      <div className="mt-3 space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-100">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-wider mb-2">متطلبات كلمة المرور:</p>
                        {[
                          { met: getPasswordRequirements().minLength, text: '8 أحرف على الأقل' },
                          { met: getPasswordRequirements().hasUpperCase, text: 'حرف كبير واحد على الأقل' },
                          { met: getPasswordRequirements().hasNumber, text: 'رقم واحد على الأقل' },
                          { met: getPasswordRequirements().hasSpecial, text: 'رمز خاص واحد على الأقل' },
                        ].map((req, idx) => (
                          <motion.div
                            key={idx}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            className={`flex items-center gap-2 text-right text-[9px] font-bold ${req.met ? 'text-emerald-600' : 'text-slate-400'}`}
                          >
                            <i className={`fa-solid ${req.met ? 'fa-check-circle' : 'fa-circle'} text-xs`}></i>
                            {req.text}
                          </motion.div>
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
                            <motion.div
                              key={password === confirmPassword ? 'match' : 'mismatch'}
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              className="flex items-center"
                            >
                              {password === confirmPassword ? (
                                <motion.div className="flex items-center gap-1">
                                  <i className="fa-solid fa-circle-check text-emerald-500 text-sm"></i>
                                  <span className="text-[8px] font-black text-emerald-600">متطابقة</span>
                                </motion.div>
                              ) : (
                                <motion.div className="flex items-center gap-1">
                                  <i className="fa-solid fa-circle-xmark text-red-500 text-sm"></i>
                                  <span className="text-[8px] font-black text-red-600">غير متطابقة</span>
                                </motion.div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="text-slate-400 hover:text-brand-navy transition-colors p-1 hover:bg-slate-100 rounded-lg"
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
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole('user')}
                      className={`p-4 rounded-3xl border-2 transition-all text-right flex flex-col gap-2 cursor-pointer ${selectedRole === 'user' ? 'border-brand-navy bg-brand-navy/5 shadow-lg ring-4 ring-brand-navy/10' : 'border-slate-100 bg-slate-50 hover:border-brand-navy/40 hover:bg-slate-100 shadow-sm'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${selectedRole === 'user' ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/40' : 'bg-white text-slate-400 border border-slate-100 shadow-sm group-hover:bg-brand-navy/5'}`}>
                        <i className="fa-solid fa-user"></i>
                      </div>
                      <div>
                        <p className={`text-xs font-black ${selectedRole === 'user' ? 'text-brand-navy' : 'text-slate-700'}`}>عميل</p>
                        <p className="text-[10px] font-bold text-slate-400">أبحث عن استشارة</p>
                      </div>
                    </motion.button>
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.02, y: -2 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setSelectedRole('pro')}
                      className={`p-4 rounded-3xl border-2 transition-all text-right flex flex-col gap-2 cursor-pointer ${selectedRole === 'pro' ? 'border-brand-navy bg-brand-navy/5 shadow-lg ring-4 ring-brand-navy/10' : 'border-slate-100 bg-slate-50 hover:border-brand-navy/40 hover:bg-slate-100 shadow-sm'}`}
                    >
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${selectedRole === 'pro' ? 'bg-brand-navy text-white shadow-lg shadow-brand-navy/40' : 'bg-white text-slate-400 border border-slate-100 shadow-sm'}`}>
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
                  disabled={loading}
                  onMouseMove={handleMagnetMove}
                  onMouseLeave={resetMagnet}
                  animate={{ x: mousePos.x, y: mousePos.y }}
                  transition={{ type: 'spring', stiffness: 150, damping: 15 }}
                  whileHover={{ scale: 1.01, boxShadow: "0 0 25px rgba(197, 160, 89, 0.4)" }}
                  whileTap={{ scale: 0.99 }}
                  className="w-full rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all duration-300 hover:shadow-2xl hover:shadow-brand-navy/30 hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-lg disabled:hover:translate-y-0 relative overflow-hidden group"
                >
                  <span className="relative z-10 flex items-center justify-center gap-2">
                    <i className="fa-solid fa-user-plus"></i>
                    فتح حساب جديد
                  </span>
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-0 group-hover:opacity-20 transform group-hover:translate-x-full transition-all duration-500" style={{ width: '100%' }}></div>
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Forgot Password Modal */}
          <AnimatePresence>
            {showForgotPassword && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 flex items-center justify-center z-[1000]"
                onClick={() => setShowForgotPassword(false)}
              >
                <motion.div
                  initial={{ opacity: 0, y: 20, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 20, scale: 0.95 }}
                  onClick={(e) => e.stopPropagation()}
                  className="bg-white rounded-3xl p-8 w-full max-w-md mx-4 shadow-2xl"
                >
                  {/* Header */}
                  <div className="flex items-center justify-between mb-6">
                    <button
                      onClick={() => setShowForgotPassword(false)}
                      className="text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      <i className="fa-solid fa-times text-lg"></i>
                    </button>
                    <h2 className="text-xl font-black text-brand-navy">إعادة تعيين كلمة المرور</h2>
                    <div className="w-8" />
                  </div>

                  <p className="text-sm text-slate-600 text-right mb-6">
                    أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.
                  </p>

                  {/* Message Display */}
                  <AnimatePresence>
                    {forgotPasswordMessage && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className={`mb-6 p-4 rounded-2xl flex gap-3 items-start ${forgotPasswordMessage.type === 'success'
                            ? 'bg-emerald-50 border border-emerald-200'
                            : 'bg-red-50 border border-red-200'
                          }`}
                      >
                        <div className={`flex-shrink-0 mt-0.5 ${forgotPasswordMessage.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
                          <i className={`fa-solid ${forgotPasswordMessage.type === 'success' ? 'fa-check-circle' : 'fa-circle-exclamation'} text-lg`}></i>
                        </div>
                        <p className={`text-sm font-bold ${forgotPasswordMessage.type === 'success' ? 'text-emerald-700' : 'text-red-700'}`}>
                          {forgotPasswordMessage.text}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Form */}
                  <form onSubmit={handleForgotPassword} className="space-y-6">
                    <div>
                      <label className="mb-2 block text-right text-[11px] font-black uppercase tracking-widest text-slate-400">
                        البريد الإلكتروني
                      </label>
                      <motion.input
                        type="email"
                        placeholder="your@email.com"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        disabled={forgotPasswordLoading}
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition-all duration-200 focus:bg-white outline-none focus:ring-4 focus:border-brand-navy focus:ring-brand-navy/5 shadow-inner placeholder:text-slate-400 disabled:bg-slate-50 disabled:opacity-60"
                        dir="ltr"
                      />
                    </div>

                    <div className="flex gap-3">
                      <motion.button
                        type="button"
                        onClick={() => setShowForgotPassword(false)}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        disabled={forgotPasswordLoading}
                        className="flex-1 rounded-2xl border-2 border-slate-200 py-3 font-bold text-sm text-slate-600 transition-all hover:border-slate-300 hover:bg-slate-50 disabled:opacity-60"
                      >
                        إلغاء
                      </motion.button>
                      <motion.button
                        type="submit"
                        disabled={forgotPasswordLoading || !forgotEmail}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="flex-1 rounded-2xl bg-[linear-gradient(135deg,#1B365D_0%,#0d2a59_100%)] py-3 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all hover:shadow-2xl hover:shadow-brand-navy/30 disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
                      >
                        {forgotPasswordLoading ? (
                          <span className="flex items-center justify-center gap-2">
                            <motion.i
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                              className="fa-solid fa-spinner text-sm"
                            />
                            إرسال
                          </span>
                        ) : (
                          <span className="flex items-center justify-center gap-2">
                            <i className="fa-solid fa-envelope text-sm"></i>
                            إرسال رابط التعيين
                          </span>
                        )}
                      </motion.button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
