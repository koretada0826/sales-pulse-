import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth.jsx';
import { ToastProvider } from './hooks/useToast.jsx';
import { RealtimeProvider } from './hooks/useRealtime.jsx';

import Login from './pages/Login.jsx';
import Layout from './components/Layout.jsx';
import Home from './pages/Home.jsx';
import AppointmentNew from './pages/AppointmentNew.jsx';
import History from './pages/History.jsx';
import Ranking from './pages/Ranking.jsx';
import NotificationsPage from './pages/Notifications.jsx';
import Settings from './pages/Settings.jsx';
import AdminDashboard from './pages/admin/Dashboard.jsx';
import AdminUsers from './pages/admin/Users.jsx';
import AdminAppointments from './pages/admin/Appointments.jsx';
import ChangePassword from './pages/ChangePassword.jsx';

function Protected({ children, admin }) {
  const { user, loading } = useAuth();
  if (loading) return <SplashScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (admin && user.role !== 'admin') return <Navigate to="/" replace />;
  if (user.must_change_password) return <Navigate to="/change-password" replace />;
  return children;
}

function SplashScreen() {
  return (
    <div className="flex h-screen items-center justify-center text-slate-300">
      <div className="text-center">
        <div className="text-3xl font-bold mb-2 bg-gradient-to-r from-accent-blue via-accent-purple to-accent-gold bg-clip-text text-transparent">Sales Pulse</div>
        <div className="opacity-60">起動中...</div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <RealtimeProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/change-password" element={<ChangePassword />} />

            <Route element={<Protected><Layout /></Protected>}>
              <Route path="/" element={<Home />} />
              <Route path="/new" element={<AppointmentNew />} />
              <Route path="/history" element={<History />} />
              <Route path="/ranking" element={<Ranking />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/settings" element={<Settings />} />

              <Route path="/admin" element={<Protected admin><AdminDashboard /></Protected>} />
              <Route path="/admin/users" element={<Protected admin><AdminUsers /></Protected>} />
              <Route path="/admin/appointments" element={<Protected admin><AdminAppointments /></Protected>} />
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RealtimeProvider>
      </AuthProvider>
    </ToastProvider>
  );
}
