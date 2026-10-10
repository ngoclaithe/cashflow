import React, { useState, useEffect } from 'react';
import { Navbar } from './components/Navbar';
import { DashboardView } from './components/DashboardView';
import { TransactionsView } from './components/TransactionsView';
import { BudgetsView } from './components/BudgetsView';
import { SavingsView } from './components/SavingsView';
import { IntegrationsView } from './components/IntegrationsView';
import { SettingsView } from './components/SettingsView';
import { AuthModal } from './components/AuthModal';
import { IosInstallPrompt } from './components/IosInstallPrompt';
import { api } from './api/client';
import {
  User,
  DashboardSummary,
  Transaction,
  Category,
  Account,
  BudgetStatus,
  SavingsGoal,
  CategorizationRule,
  SyncRun,
} from './types';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [user, setUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);

  // Core Data
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [cashFlowHistory, setCashFlowHistory] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState({ total: 0, page: 1, limit: 20, totalPages: 1 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [budgets, setBudgets] = useState<BudgetStatus[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [rules, setRules] = useState<CategorizationRule[]>([]);
  const [syncRuns, setSyncRuns] = useState<SyncRun[]>([]);
  const [reconciliationStatus, setReconciliationStatus] = useState<any>(null);

  // States
  const [isSyncing, setIsSyncing] = useState(false);
  const [isReconciling, setIsReconciling] = useState(false);
  const [activeFilters, setActiveFilters] = useState<any>({});

  // Initialize
  useEffect(() => {
    initAuthAndData();
  }, []);

  const initAuthAndData = async () => {
    try {
      // 1. Check existing token
      const me = await api.getMe();
      setUser(me);
      await loadAllData();
    } catch {
      // 2. Auto-login with default seeded credentials for instant convenience
      try {
        const loginRes = await api.login('admin@cashflow.local', 'admin123456');
        setUser(loginRes.user);
        await loadAllData();
      } catch {
        setIsAuthOpen(true);
      }
    }
  };

  const loadAllData = async () => {
    try {
      const [
        sumData,
        cfData,
        txData,
        catData,
        accData,
        budData,
        goalData,
        ruleData,
        syncData,
        reconData,
      ] = await Promise.all([
        api.getDashboardSummary().catch(() => null),
        api.getCashFlow(6).catch(() => []),
        api.getTransactions().catch(() => ({ items: [], pagination: { total: 0, page: 1, limit: 20, totalPages: 1 } })),
        api.getCategories().catch(() => []),
        api.getAccounts().catch(() => []),
        api.getBudgets().catch(() => []),
        api.getSavingsGoals().catch(() => []),
        api.getRules().catch(() => []),
        api.getSyncRuns().catch(() => []),
        api.getReconciliationStatus().catch(() => null),
      ]);

      if (sumData) setSummary(sumData);
      setCashFlowHistory(cfData);
      if (txData) {
        setTransactions(txData.items);
        setPagination(txData.pagination);
      }
      setCategories(catData);
      setAccounts(accData);
      setBudgets(budData);
      setSavingsGoals(goalData);
      setRules(ruleData);
      setSyncRuns(syncData);
      setReconciliationStatus(reconData);
    } catch (e) {
      console.error('Error loading data:', e);
    }
  };

  const handleLogout = () => {
    api.clearToken();
    setUser(null);
    setIsAuthOpen(true);
  };

  const handleTriggerSync = async () => {
    setIsSyncing(true);
    try {
      await api.triggerSync(3);
      await loadAllData();
    } catch (e: any) {
      alert(`Đồng bộ thất bại: ${e.message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRunReconciliation = async () => {
    setIsReconciling(true);
    try {
      await api.runReconciliation(2);
      await loadAllData();
    } catch (e: any) {
      alert(`Đối soát thất bại: ${e.message}`);
    } finally {
      setIsReconciling(false);
    }
  };

  const handleFilterChange = async (filters: any) => {
    setActiveFilters(filters);
    try {
      const txData = await api.getTransactions(filters);
      setTransactions(txData.items);
      setPagination(txData.pagination);
    } catch (e) {
      console.error(e);
    }
  };

  const handlePageChange = async (page: number) => {
    const newFilters = { ...activeFilters, page };
    handleFilterChange(newFilters);
  };

  const handleReclassify = async (txId: string, categoryId: string) => {
    try {
      await api.reclassifyTransaction(txId, categoryId);
      await loadAllData();
    } catch (e: any) {
      alert(`Không thể đổi phân loại: ${e.message}`);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm('Bạn có chắc muốn xóa giao dịch này?')) return;
    try {
      await api.deleteTransaction(txId);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi xóa: ${e.message}`);
    }
  };

  const handleAddTransaction = async (data: any) => {
    try {
      await api.createTransaction(data);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi thêm: ${e.message}`);
    }
  };

  const handleAddBudget = async (data: any) => {
    try {
      await api.createBudget(data);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi tạo ngân sách: ${e.message}`);
    }
  };

  const handleDeleteBudget = async (id: string) => {
    if (!window.confirm('Xóa ngân sách này?')) return;
    try {
      await api.deleteBudget(id);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi xóa: ${e.message}`);
    }
  };

  const handleAddGoal = async (data: any) => {
    try {
      await api.createSavingsGoal(data);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi tạo mục tiêu: ${e.message}`);
    }
  };

  const handleDeleteGoal = async (id: string) => {
    if (!window.confirm('Xóa mục tiêu này?')) return;
    try {
      await api.deleteSavingsGoal(id);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi xóa: ${e.message}`);
    }
  };

  const handleAddRule = async (data: any) => {
    try {
      await api.createRule(data);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi tạo quy tắc: ${e.message}`);
    }
  };

  const handleDeleteRule = async (id: string) => {
    if (!window.confirm('Xóa quy tắc này?')) return;
    try {
      await api.deleteRule(id);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi xóa: ${e.message}`);
    }
  };

  const handleAddCategory = async (data: any) => {
    try {
      await api.createCategory(data);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi tạo danh mục: ${e.message}`);
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!window.confirm('Xóa danh mục này?')) return;
    try {
      await api.deleteCategory(id);
      await loadAllData();
    } catch (e: any) {
      alert(`Lỗi khi xóa: ${e.message}`);
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onSync={handleTriggerSync}
        isSyncing={isSyncing}
        totalBalance={summary?.availableCash}
      />

      <main style={{ flex: 1, maxWidth: '1200px', width: '100%', margin: '0 auto', padding: '16px 14px' }}>
        {activeTab === 'dashboard' && (
          <DashboardView
            summary={summary}
            cashFlowHistory={cashFlowHistory}
            onViewAllTransactions={() => setActiveTab('transactions')}
            onOpenAddTransaction={() => setActiveTab('transactions')}
          />
        )}

        {activeTab === 'transactions' && (
          <TransactionsView
            transactions={transactions}
            pagination={pagination}
            categories={categories}
            accounts={accounts}
            onPageChange={handlePageChange}
            onFilterChange={handleFilterChange}
            onReclassify={handleReclassify}
            onDeleteTransaction={handleDeleteTransaction}
            onAddTransaction={handleAddTransaction}
            onAddRule={handleAddRule}
          />
        )}

        {activeTab === 'budgets' && (
          <BudgetsView
            budgets={budgets}
            categories={categories}
            onAddBudget={handleAddBudget}
            onDeleteBudget={handleDeleteBudget}
          />
        )}

        {activeTab === 'savings' && (
          <SavingsView
            savingsGoals={savingsGoals}
            onAddGoal={handleAddGoal}
            onDeleteGoal={handleDeleteGoal}
          />
        )}

        {activeTab === 'integrations' && (
          <IntegrationsView
            syncRuns={syncRuns}
            reconciliationStatus={reconciliationStatus}
            onTriggerSync={handleTriggerSync}
            onRunReconciliation={handleRunReconciliation}
            onSendMockWebhook={async (d) => {
              await api.sendMockWebhook(d);
              await loadAllData();
            }}
            isSyncing={isSyncing}
            isReconciling={isReconciling}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsView
            rules={rules}
            categories={categories}
            onAddRule={handleAddRule}
            onDeleteRule={handleDeleteRule}
            onAddCategory={handleAddCategory}
            onDeleteCategory={handleDeleteCategory}
            onTestTelegram={() => api.testTelegram()}
          />
        )}
      </main>

      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={(u) => {
          setUser(u);
          loadAllData();
        }}
      />

      <IosInstallPrompt />
    </div>
  );
};
export default App;
