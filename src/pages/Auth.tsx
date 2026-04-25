import React, { useState } from 'react';
import { useAuth, Role } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

export default function Auth() {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('user');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const loggedInUser = await login(email, password);
      navigate(loggedInUser.role === 'admin' ? '/admin' : loggedInUser.role === 'pro' ? '/pro' : '/user');
    } catch (err: any) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const registeredUser = await register(email, password, name, selectedRole);
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
              onClick={() => setAuthMode('login')}
              className={`flex-1 pb-3 text-center font-bold border-b-2 transition ${authMode === 'login' ? 'text-brand-gold border-brand-gold' : 'text-gray-400 border-transparent hover:text-gray-600'
                }`}
            >
              تسجيل الدخول
            </button>
            <button
              onClick={() => setAuthMode('register')}
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
      <div className="hidden lg:flex w-1/2 grad-navy flex-col items-center justify-center text-white text-center px-8">
        <div className="max-w-md">
          <h2 className="text-4xl font-bold mb-6">العدالة في متناول الجميع</h2>
          <p className="text-lg mb-8 text-gray-200">
            منصة قانونية ذكية تجمع بين خبرة المحامين والتقنية الحديثة لخدمة المجتمع العراقي
          </p>
          <div className="space-y-4 text-left">
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-check text-brand-gold mt-1"></i>
              <div>
                <p className="font-bold">استشارات قانونية موثوقة</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-check text-brand-gold mt-1"></i>
              <div>
                <p className="font-bold">متابعة قضاياك بسهولة</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <i className="fa-solid fa-check text-brand-gold mt-1"></i>
              <div>
                <p className="font-bold">نصائح من الخبراء</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
