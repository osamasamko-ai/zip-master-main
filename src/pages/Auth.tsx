import React, { useState } from 'react';
import { useAuth, Role } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
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
    setSelectedRole('user');
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
    <div className="fixed inset-0 z-[200] flex min-h-screen bg-white fade-in">
      {/* Right Side: Form */}
      <div className="flex w-full flex-col justify-center px-8 md:px-24 lg:w-1/2">
        <div className="max-w-md w-full mx-auto">
          <div className="flex flex-row items-center gap-3 mb-8">
            <div className="w-12 h-12 grad-navy rounded-xl flex items-center justify-center text-brand-gold shadow-gold-glow">
              <i className="fa-solid fa-scale-balanced text-2xl"></i>
            </div>
            <div>
              <h1 className="text-3xl font-bold leading-none text-brand-dark">القسطاس </h1>
              <span className="text-sm font-semibold text-gray-500">منظومة العدالة الرقمية العراقية المدعومة بالذكاء الاصطناعي</span>
            </div>
          </div>

          <div className="mb-8 flex flex-row border-b border-gray-200">
            <button
              onClick={() => {
                setError(null);
                setAuthMode('login');
              }}
              className={`flex-1 pb-3 text-center font-bold border-b-2 transition ${authMode === 'login' ? 'text-brand-gold border-brand-gold' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => {
                setError(null);
                setAuthMode('register');
              }}
              className={`flex-1 pb-3 text-center font-bold border-b-2 transition ${authMode === 'register' ? 'text-brand-gold border-brand-gold' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
            >
              حساب جديد
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
              {error}
            </div>
          )}

          {/* Login Form */}
          {authMode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-5 fade-in">
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">كلمة المرور</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl grad-gold py-3 font-bold text-white shadow-gold-glow transition hover:shadow-gold-glow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'جاري التحميل...' : 'تسجيل الدخول'}
              </button>
            </form>
          )}

          {/* Register Form */}
          {authMode === 'register' && (
            <form onSubmit={handleRegister} className="space-y-5 fade-in">
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">الاسم الكامل</label>
                <input
                  type="text"
                  placeholder="أدخل اسمك الكامل"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">البريد الإلكتروني</label>
                <input
                  type="email"
                  placeholder="example@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">كلمة المرور</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
                <p className="mt-2 text-right text-xs font-bold text-slate-400">8 أحرف على الأقل.</p>
              </div>
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">تأكيد كلمة المرور</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                />
              </div>
              <div>
                <label className="mb-2 block text-right text-sm font-bold text-gray-700">نوع الحساب</label>
                <select
                  value={selectedRole}
                  onChange={(e) => setSelectedRole(e.target.value as Role)}
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-right transition focus:border-brand-gold focus:outline-none focus:ring-1 focus:ring-brand-gold"
                >
                  <option value="user">عميل (باحث عن استشارة)</option>
                  <option value="pro">محامي</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-xl grad-gold py-3 font-bold text-white shadow-gold-glow transition hover:shadow-gold-glow-lg disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'جاري التحميل...' : 'إنشاء حساب'}
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Left Side: Branding */}
      <div className="hidden lg:flex w-1/2 grad-navy flex-col items-center justify-center text-white text-center px-12">
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
      </div>
    </div>
  );
}
