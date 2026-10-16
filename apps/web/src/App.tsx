import React, { useState, useEffect } from 'react';
import { Navbar } from './widgets/navbar';
import { DashboardPage } from './pages/dashboard';
import { CalendarPage } from './pages/calendar';
import { TransactionsPage } from './pages/transactions';
import { BudgetsPage } from './pages/budgets';
import { SavingsPage } from './pages/savings';
import { CategoriesPage } from './pages/categories';
import { AnalyticsPage } from './pages/analytics';
import { ReportPage } from './pages/report';
import { AuthPage } from './features/auth';
import { IosInstallPrompt } from './features/pwa';
import { api } from './shared/api/client';
import { User } from './shared/types';
import { useNavigationStore, NavigationTab } from './shared/stores';

export const App: React.FC = () => {
  const { activeTab, setActiveTab, syncWithUrl } = useNavigationStore();
  const [user, setUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncKey, setSyncKey] = useState(0);

  useEffect(() => {
    syncWithUrl();
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const me = await api.getMe();
      if (me && me.id) {
        setUser(me);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleLogout = () => {
    api.clearToken();
    try {
      localStorage.removeItem('cashflow_active_tab');
    } catch {}
    setUser(null);
    setActiveTab('dashboard');
  };

  const handleTriggerSync = async () => {
    if (!user) return;
    setIsSyncing(true);
    try {
      await api.triggerSync(1);
      setSyncKey((prev) => prev + 1);
    } catch (err: any) {
      console.warn('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // 1. Loading splash while verifying auth
  if (isInitializing) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-main)',
          color: 'var(--text-muted)',
          fontSize: '14px',
        }}
      >
        Đang khởi động Cashflow...
      </div>
    );
  }

  // 2. Strict Auth Wall: If not logged in, render ONLY AuthPage
  if (!user) {
    return <AuthPage onSuccess={(u) => setUser(u)} />;
  }

  // 3. Authenticated App Layout (FSD)
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenAuth={() => {}}
        onLogout={handleLogout}
        onSync={handleTriggerSync}
        isSyncing={isSyncing}
      />

      <main
        style={{
          flex: 1,
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
          padding: '16px 14px',
        }}
      >
        {activeTab === 'dashboard' && <DashboardPage onNavigate={setActiveTab} refreshKey={syncKey} />}
        {activeTab === 'calendar' && <TransactionsPage onNavigate={setActiveTab} initialView="calendar" refreshKey={syncKey} />}
        {activeTab === 'transactions' && <TransactionsPage onNavigate={setActiveTab} refreshKey={syncKey} />}
        {activeTab === 'report' && <ReportPage onNavigate={setActiveTab} refreshKey={syncKey} />}
        {activeTab === 'analytics' && <AnalyticsPage onNavigate={setActiveTab} refreshKey={syncKey} />}
        {activeTab === 'budgets' && <BudgetsPage refreshKey={syncKey} />}
        {activeTab === 'savings' && <SavingsPage refreshKey={syncKey} />}
        {activeTab === 'categories' && <CategoriesPage refreshKey={syncKey} />}
      </main>

      <IosInstallPrompt />
    </div>
  );
};

export default App;
