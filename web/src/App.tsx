import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, App as AntApp } from 'antd';
import enUS from 'antd/locale/en_US';
import { useAuthStore } from './stores/authStore';

// Layouts
import MainLayout from './layouts/MainLayout';

// Pages
import LoginPage from './pages/login';
import DashboardPage from './pages/dashboard';
import EmailsPage from './pages/emails';
import ApiKeysPage from './pages/api-keys';
import ApiDocsPage from './pages/api-docs';
import OperationLogsPage from './pages/operation-logs';
import AdminsPage from './pages/admins';
import SettingsPage from './pages/settings';

// Route guard component
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// Super admin route guard
const SuperAdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, admin } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (admin?.role !== 'super_admin') {
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

const App: React.FC = () => {
  return (
    <ConfigProvider
      locale={enUS}
      theme={{
        cssVar: {},
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <AntApp>
        <BrowserRouter>
          <Routes>
            {/* Login page */}
            <Route path="/login" element={<LoginPage />} />

            {/* Pages requiring authentication */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <MainLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="emails" element={<EmailsPage />} />
              <Route path="api-keys" element={<ApiKeysPage />} />
              <Route path="api-docs" element={<ApiDocsPage />} />
              <Route path="operation-logs" element={<OperationLogsPage />} />
              <Route
                path="admins"
                element={
                  <SuperAdminRoute>
                    <AdminsPage />
                  </SuperAdminRoute>
                }
              />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* 404 redirect */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AntApp>
    </ConfigProvider>
  );
};

export default App;
