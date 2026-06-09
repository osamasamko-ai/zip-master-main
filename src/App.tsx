/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import MainLayout from './components/MainLayout';

const Auth = lazy(() => import('./pages/Auth'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const AiChat = lazy(() => import('./pages/AiChat'));
const ProDashboard = lazy(() => import('./pages/ProDashboard'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const MyCases = lazy(() => import('./pages/MyCases'));
const LegalDocs = lazy(() => import('./pages/LegalDocs'));
const Following = lazy(() => import('./pages/Following'));
const Feed = lazy(() => import('./pages/Feed'));
const Lawyers = lazy(() => import('./pages/Lawyers'));
const Messages = lazy(() => import('./pages/Messages'));
const Billing = lazy(() => import('./pages/Billing'));
const Support = lazy(() => import('./pages/Support'));
const ContractWizard = lazy(() => import('./pages/ContractWizard'));
const ExternalSignature = lazy(() => import('./pages/ExternalSignature'));
const LegalActionPlan = lazy(() => import('./pages/LegalActionPlan'));
const CaseStore = lazy(() => import('./pages/CaseStore'));
const NotFound = lazy(() => import('./pages/NotFound'));
const Verify = lazy(() => import('./pages/Verify'));

type AppRole = 'user' | 'pro' | 'lawyer' | 'admin';

function isProfessionalRole(role?: string | null) {
  return role === 'pro' || role === 'lawyer';
}

function getDefaultRoute(role: AppRole | null) {
  if (role === 'admin') return '/admin';
  if (isProfessionalRole(role)) return '/pro';
  return '/user';
}

function RequireAuth({ children }: { children: React.ReactElement }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return children;
}

function RequireRole({
  children,
  allowedRoles,
}: {
  children: React.ReactElement;
  allowedRoles: AppRole[];
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const normalizedRole = user.role === 'lawyer' ? 'pro' : user.role;
  const normalizedAllowedRoles = allowedRoles.map((role) => (role === 'lawyer' ? 'pro' : role));

  if (!normalizedAllowedRoles.includes(normalizedRole as AppRole)) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return children;
}

function OwnProfileRedirect() {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  return <Navigate to={`/profile/${user.id}`} replace />;
}

function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 text-right">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-100 bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between gap-3">
          <span className="h-10 w-10 rounded-2xl bg-brand-navy/10" />
          <div className="flex-1 space-y-2">
            <span className="block h-3 w-2/3 rounded-full bg-slate-100" />
            <span className="block h-2 w-1/2 rounded-full bg-slate-100" />
          </div>
        </div>
        <div className="space-y-3">
          <span className="block h-16 rounded-2xl bg-slate-100" />
          <span className="block h-16 rounded-2xl bg-slate-100" />
          <span className="block h-16 rounded-2xl bg-slate-100" />
        </div>
      </div>
    </div>
  );
}

class PageErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.error('Page render error:', error);
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-right">
        <div className="w-full max-w-lg rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
          <div className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-500">
            <i className="fa-solid fa-triangle-exclamation text-xl"></i>
          </div>
          <h1 className="text-2xl font-black text-brand-dark">تعذر عرض الصفحة</h1>
          <p className="mt-2 text-sm font-bold leading-7 text-slate-500">
            حدث خطأ غير متوقع في هذه الصفحة. يمكن إعادة تحميلها أو العودة للوحة الرئيسية بدون فقدان بقية الموقع.
          </p>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-2xl bg-brand-navy px-4 py-3 text-xs font-black text-white transition hover:bg-brand-dark"
            >
              إعادة التحميل
            </button>
            <button
              type="button"
              onClick={() => { window.location.href = '/user'; }}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black text-brand-navy transition hover:bg-slate-50"
            >
              الرئيسية
            </button>
          </div>
        </div>
      </div>
    );
  }
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <NotificationProvider> {/* NotificationProvider must be inside Router to use useNavigate */}
          <PageErrorBoundary>
            <Suspense fallback={<AppLoading />}>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/verify/:id" element={<Verify />} />
                <Route path="/sign/:id" element={<ExternalSignature />} />
                {/* Public profile view (accessible without signing in) */}
                <Route element={<MainLayout />}>
                  <Route path="/profile/:id" element={<Profile />} />
                </Route>
                <Route
                  path="/"
                  element={
                    <RequireAuth>
                      <MainLayout />
                    </RequireAuth>
                  }
                >
                  <Route index element={<Navigate to="/user" replace />} />
                  <Route path="user" element={<UserDashboard />} />
                  <Route path="cases" element={<MyCases />} />
                  <Route path="lawyers" element={<Lawyers />} />
                  <Route path="messages" element={<Messages />} />
                  <Route path="billing" element={<Billing />} />
                  <Route path="contract" element={<ContractWizard />} />
                  <Route path="contracts" element={<ContractWizard />} />
                  <Route path="action-plan" element={<LegalActionPlan />} />
                  <Route path="support" element={<Support />} />
                  <Route path="aichat" element={<AiChat />} />
                  <Route path="legal" element={<LegalDocs />} />
                  <Route path="following" element={<Following />} />
                  <Route path="feed" element={<Feed />} />
                  <Route path="profile/:id" element={<Profile />} />
                  <Route
                    path="pro"
                    element={
                      <RequireRole allowedRoles={['pro', 'admin']}>
                        <ProDashboard />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="case-store"
                    element={
                      <RequireRole allowedRoles={['pro', 'admin']}>
                        <CaseStore />
                      </RequireRole>
                    }
                  />
                  <Route
                    path="admin"
                    element={
                      <RequireRole allowedRoles={['admin']}>
                        <AdminDashboard />
                      </RequireRole>
                    }
                  />
                  <Route path="profile" element={<OwnProfileRedirect />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="*" element={<NotFound />} />
                </Route>
              </Routes>
            </Suspense>
          </PageErrorBoundary>
        </NotificationProvider>
      </Router>
    </AuthProvider>
  );
}
