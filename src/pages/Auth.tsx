import React, { useState } from 'react';
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
    <div className="relative z-[200] flex min-h-screen flex-col lg:flex-row bg-white fade-in">
      {/* Right Side: Form */}
      <div className="flex w-full flex-col justify-center px-6 py-12 md:px-24 lg:w-1/2 lg:py-0">
        <div className="max-w-md w-full mx-auto">
          <div className="flex flex-row items-center gap-3 mb-8">
            <div className="w-12 h-12 grad-navy rounded-xl flex items-center justify-center text-brand-gold shadow-gold-glow">
              <i className="fa-solid fa-scale-balanced text-2xl"></i>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black leading-none text-brand-dark tracking-tight">القسطاس</h1>
              <p className="text-xs font-bold text-slate-400 mt-1 tracking-tight">منظومة العدالة الرقمية العراقية المدعومة بالذكاء الاصطناعي</p>
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
            {/* Login Form */}
            {authMode === 'login' && (
              <motion.form
                key="login"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
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
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl grad-navy py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'جاري التحقق...' : 'دخول للمنصة'}
                </button>
              </motion.form>
            )}

            {/* Register Form */}
            {authMode === 'register' && (
              <motion.form
                key="register"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2, ease: 'easeOut' }}
                onSubmit={handleRegister}
                className="space-y-5"
              >
                <div>
                  <label className={`mb-2 block text-right text-[11px] font-black uppercase tracking-widest transition-colors ${getFieldError('name') ? 'text-red-500' : 'text-slate-400'}`}>الاسم الكامل</label>
                  <motion.div animate={getFieldError('name') ? { x: [0, -4, 4, -4, 4, 0] } : {}} transition={{ duration: 0.4 }}>
                    <input
                      type="text"
                      placeholder="اكتب اسمك الثلاثي"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      required
                      className={`w-full rounded-2xl border px-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('name') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                        }`}
                    />
                  </motion.div>
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
                  <p className="mt-2 text-right text-[10px] font-bold text-slate-400">يجب أن تتكون من 8 أحرف أو رموز على الأقل.</p>
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
                        className={`w-full rounded-2xl border pl-12 pr-4 py-3.5 text-right text-sm font-bold text-slate-700 transition focus:bg-white outline-none focus:ring-4 shadow-inner ${getFieldError('confirmPassword') ? 'border-red-300 bg-red-50/30 focus:border-red-500 focus:ring-red-500/10' : 'border-slate-200 bg-slate-50 focus:border-brand-navy focus:ring-brand-navy/5'
                          }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-brand-navy transition-colors p-1"
                      >
                        <i className={`fa-solid ${showConfirmPassword ? 'fa-eye-slash' : 'fa-eye'} text-xs`}></i>
                      </button>
                    </div>
                  </motion.div>
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
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-2xl grad-navy py-4 font-black text-sm text-white shadow-lg shadow-brand-navy/20 transition-all hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center justify-center gap-2">
                      <i className="fa-solid fa-circle-notch fa-spin"></i>
                      جاري المعالجة...
                    </span>
                  ) : 'فتح حساب جديد'}
                </button>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Left Side: Branding */}
      < div className="hidden lg:flex w-1/2 grad-navy flex-col items-center justify-center text-white text-center px-12" >
        <div className="max-w-lg">
          <h2 className="text-4xl font-black mb-8 leading-tight">العدالة لم تعد بعيدة.. حقك الآن أقرب إليك من أي وقت مضى</h2>

          <div className="space-y-3 mb-10 text-gray-200 text-lg font-bold">
            <p>هل تبحث عن استشارة قانونية رصينة وموثوقة؟</p>
            <p>هل تواجه صعوبة في تتبع مسار قضيتك أو تائه في الخطوات الأولى؟</p>
          </div>

          <div className="mb-10">
            <p className="text-xl font-black mb-6 text-brand-gold ">منصتنا الرقمية المتكاملة تضع الحل بين يديك:</p>
            <div className="space-y-5 inline-block text-right">
              <div className="flex flex-row-reverse items-center gap-4 text-right">
                <p className="font-bold text-lg text-right">تواصل فوري ومباشر مع نخبة من المحامين المعتمدين</p>
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-check text-brand-gold"></i>
                </div>
              </div>
              <div className="flex flex-row-reverse items-center gap-4 text-right">
                <p className="font-bold text-lg text-right">شفافية تامة في تتبع سير الدعوى لحظة بلحظة</p>
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-check text-brand-gold"></i>
                </div>
              </div>
              <div className="flex flex-row-reverse items-center gap-4 text-right">
                <p className="font-bold text-lg text-right">حلول قانونية دقيقة مبنية على خبرات تخصصية</p>
                <div className="w-8 h-8 rounded-full bg-brand-gold/20 flex items-center justify-center shrink-0">
                  <i className="fa-solid fa-check text-brand-gold"></i>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[2.5rem] bg-white/5 border border-white/10 p-8 mb-12 backdrop-blur-md text-center shadow-2xl">
            <p className="text-xl font-black text-brand-gold mb-4 border-b border-white/10 pb-4 ">نحن لا نقدم خدمة فقط، بل نضمن حقك</p>
            <div className="space-y-3 text-sm md:text-base font-bold text-gray-200 ">
              <div className="flex flex-row-reverse items-start gap-3 ">
                <p>ضمان استرجاع كامل الأتعاب في حال تخلّف المحامي عن المتابعة</p>
                <i className="fa-solid fa-shield-halved text-brand-gold mt-1"></i>
              </div>
              <div className="flex flex-row-reverse items-start gap-3 ">
                <p>توفير محامٍ بديل فوراً لضمان استمرارية دعواك دون انقطاع</p>
                <i className="fa-solid fa-user-tie text-brand-gold mt-1"></i>
              </div>
            </div>
          </div>

          <div className="space-y-4 ">
            <p className="text-lg font-bold text-gray-300">اتخذ الخطوة الأولى نحو استعادة حقوقك اليوم</p>
            <h3 className="text-4xl font-black text-brand-gold tracking-tight">العدالة في متناول الجميع</h3>
          </div>
        </div>
      </div >
    </div >
  );
}
