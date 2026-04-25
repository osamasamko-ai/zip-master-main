/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';
import Auth from './pages/Auth';
import MainLayout from './components/MainLayout';
import UserDashboard from './pages/UserDashboard';
import AiChat from './pages/AiChat';
import ProDashboard from './pages/ProDashboard';
import AdminDashboard from './pages/AdminDashboard';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import MyCases from './pages/MyCases';
import LegalDocs from './pages/LegalDocs';
import Following from './pages/Following';
import Lawyers from './pages/Lawyers';
import Messages from './pages/Messages';
import Billing from './pages/Billing';

function getDefaultRoute(role: 'user' | 'pro' | 'admin' | null) {
  if (role === 'admin') return '/admin';
  if (role === 'pro') return '/pro';
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
  allowedRoles: Array<'user' | 'pro' | 'admin'>;
}) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user.role as 'user' | 'pro' | 'admin')) {
    return <Navigate to={getDefaultRoute(user.role)} replace />;
  }

  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <NotificationProvider> {/* NotificationProvider must be inside Router to use useNavigate */}
          <Routes>
            <Route path="/auth" element={<Auth />} />
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
              <Route path="aichat" element={<AiChat />} />
              <Route path="legal" element={<LegalDocs />} />
              <Route path="following" element={<Following />} />
              <Route
                path="pro"
                element={
                  <RequireRole allowedRoles={['pro', 'admin']}>
                    <ProDashboard />
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
              <Route path="profile/:id" element={<Profile />} />
              <Route path="profile" element={<Navigate to="/settings" replace />} />
              <Route path="settings" element={<Settings />} />
            </Route>
          </Routes>
        </NotificationProvider>
      </Router>
    </AuthProvider>
  );
}
