import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { SettingsProvider } from './contexts/SettingsContext';
import { NotificationProvider } from './components/NotificationProvider';
import { ProtectedRoute } from './components/ProtectedRoute';
import { MainLayout } from './layouts/MainLayout';
import { DashboardPage } from './pages/DashboardPage';
import { SessionsPage } from './pages/SessionsPage';
import { SessionDetailPage } from './pages/SessionDetailPage';
import { SettingsPage } from './pages/SettingsPage';
import { AdminPage } from './pages/admin/AdminPage';
import { UsersPage } from './pages/admin/UsersPage';
import { AdminSettingsPage } from './pages/admin/AdminSettingsPage';
import { LogsPage } from './pages/admin/LogsPage';

function RootRedirect() {
  // 로그인 없이 바로 대시보드로 이동
  return <Navigate to="/dashboard" replace />;
}

function App() {
  return (
    <HashRouter>
      <AuthProvider>
        <SettingsProvider>
          <NotificationProvider>
            <Routes>
              {/* Root redirect */}
              <Route path="/" element={<RootRedirect />} />

              {/* Protected routes with MainLayout */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <MainLayout />
                  </ProtectedRoute>
                }
              >
                <Route path="dashboard" element={<DashboardPage />} />
                <Route path="sessions" element={<SessionsPage />} />
                <Route path="sessions/:id" element={<SessionDetailPage />} />
                <Route path="settings" element={<SettingsPage />} />

                {/* Admin routes */}
                <Route
                  path="admin"
                  element={
                    <ProtectedRoute requireRole="ADMIN">
                      <AdminPage />
                    </ProtectedRoute>
                  }
                >
                  <Route path="users" element={<UsersPage />} />
                  <Route path="settings" element={<AdminSettingsPage />} />
                  <Route path="logs" element={<LogsPage />} />
                </Route>
              </Route>
            </Routes>
          </NotificationProvider>
        </SettingsProvider>
      </AuthProvider>
    </HashRouter>
  );
}

export default App;
