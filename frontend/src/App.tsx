import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { Layout } from './layouts/Layout';

import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { DataUpload } from './pages/DataUpload';
import { Reconciliation } from './pages/Reconciliation';
import { Transactions } from './pages/Transactions';
import { TransactionDetails } from './pages/TransactionDetails';
import { Exceptions } from './pages/Exceptions';
import { Analytics } from './pages/Analytics';
import { AuditTrail } from './pages/AuditTrail';
import { Settings } from './pages/Settings';
import { CashPosition } from './pages/CashPosition';
import { TaxVerification } from './pages/TaxVerification';
import { RunHistory } from './pages/RunHistory';
import { AgentChat } from './pages/AgentChat';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-950 text-gray-500">
        Loading...
      </div>
    );
  }
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const AppRoutes: React.FC = () => {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="assistant" element={<AgentChat />} />
        <Route path="upload" element={<DataUpload />} />
        <Route path="reconciliation" element={<Reconciliation />} />
        <Route path="transactions" element={<Transactions />} />
        <Route path="transactions/:id" element={<TransactionDetails />} />
        <Route path="exceptions" element={<Exceptions />} />
        <Route path="cash-position" element={<CashPosition />} />
        <Route path="tax-verification" element={<TaxVerification />} />
        <Route path="run-history" element={<RunHistory />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="audit-trail" element={<AuditTrail />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  );
};

export default App;
