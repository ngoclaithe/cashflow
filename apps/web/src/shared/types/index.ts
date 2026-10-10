export interface User {
  id: string;
  email: string;
  name?: string;
}

export type TransactionDirection = 'INCOME' | 'EXPENSE' | 'TRANSFER';

export interface Category {
  id: string;
  name: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  color?: string;
  icon?: string;
  parentId?: string | null;
  isSystem?: boolean;
}

export interface Account {
  id: string;
  displayName: string;
  provider: string;
  bankName?: string;
  accountNumber?: string;
  balance: number;
  currency: string;
}

export interface Transaction {
  id: string;
  accountId: string;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  description: string;
  counterparty?: string;
  code?: string;
  categoryId?: string | null;
  userCategoryOverride: boolean;
  isInternalTransfer: boolean;
  transactionDate: string;
  createdAt: string;
  category?: Category;
  account?: Account;
}

export interface BudgetStatus {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName?: string;
  categoryColor?: string;
  limitAmount: number;
  spentAmount: number;
  remainingAmount: number;
  percentageUsed: number;
  alertLevel: 'OK' | 'INFO' | 'WARNING' | 'CRITICAL';
  period: 'MONTHLY' | 'CUSTOM';
  startDate: string;
  endDate?: string | null;
  isActive: boolean;
}

export interface UpcomingObligation {
  id: string;
  name: string;
  amount: number;
  dueDate: string;
  daysRemaining: number;
  isObligation: boolean;
  isDueSoon: boolean;
  isInsufficientFunds: boolean;
  isFulfilledThisMonth?: boolean;
  fulfilledDate?: string;
  fulfilledAmount?: number;
}

export interface SavingsGoal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageAchieved: number;
  targetDate: string;
  daysRemaining: number;
  monthlyRequiredSavings: number;
}

export interface CategorizationRule {
  id: string;
  name: string;
  priority: number;
  field: 'DESCRIPTION' | 'COUNTERPARTY' | 'AMOUNT' | 'GATEWAY';
  operator: 'CONTAINS' | 'EQUALS' | 'STARTS_WITH' | 'ENDS_WITH' | 'REGEX';
  value: string;
  categoryId: string;
  isActive: boolean;
  category?: Category;
}

export interface SyncRun {
  id: string;
  provider: string;
  accountId?: string;
  startedAt: string;
  finishedAt?: string;
  status: 'PENDING' | 'SUCCESS' | 'PARTIAL' | 'FAILED';
  transactionsFetched: number;
  transactionsInserted: number;
  transactionsUpdated: number;
  transactionsSkipped: number;
  errorSummary?: string;
  createdAt: string;
}

export interface DashboardSummary {
  availableCash: number;
  currentMonth: {
    month: number;
    year: number;
    income: number;
    expenses: number;
    netCashFlow: number;
  };
  accounts: Array<{
    name: string;
    bank?: string;
    provider: string;
    balance: number;
  }>;
  categoryBreakdown: {
    totalExpense: number;
    items: Array<{
      id: string;
      name: string;
      color: string;
      icon?: string;
      amount: number;
      percentage: number;
    }>;
  };
  budgetsSummary: {
    totalLimit: number;
    totalSpent: number;
    totalRemaining: number;
    items: BudgetStatus[];
  };
  upcomingObligations: UpcomingObligation[];
  savingsGoals: SavingsGoal[];
  recentTransactions: Transaction[];
  uncategorizedCount: number;
  lastSync?: SyncRun;
}
