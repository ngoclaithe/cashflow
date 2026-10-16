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

export interface UpcomingItem {
  id: string;
  name: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  dueDate: string;
  enabled: boolean;
  category?: string;
  isQuickPreset?: boolean;
}

export interface CategoryReportItem {
  id: string;
  name: string;
  color: string;
  icon?: string;
  spent: number;
  percentOfTotal: number;
  txCount: number;
  dailyAverage: number;
  budgetAmount: number;
  remainingBudget: number | null;
  percentOfBudget: number;
  status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET';
}

export interface ProjectionScenario {
  label: string;
  description: string;
  dailyBurn: number;
  regularProjectedExpense: number;
  upcomingExpense: number;
  projectedExpense: number;
  projectedBalanceBeforeSalary: number;
  projectedBalanceAfterSalary: number;
  projectedBalanceBeforeSalaryFormatted: string;
  projectedBalanceAfterSalaryFormatted: string;
  status: 'SAFE' | 'WARNING' | 'DANGER' | 'EXCELLENT' | 'CAUTION';
}

export interface GeminiAnalysisResult {
  summary: string;
  projectionAssessment: string;
  customAnswer?: string;
  keyObservations: string[];
  recommendations: string[];
  verdict: 'AN_TOAN' | 'CAN_CHU_Y' | 'NGUY_CO';
  generatedAt?: string;
  model?: string;
}

export interface ForecastResponse {
  account: {
    id: string;
    displayName: string;
    accountNumber: string;
    balance: number;
    totalCash: number;
  };
  timeframe: {
    startDate: string;
    startDateFormatted: string;
    endDate: string;
    endDateFormatted: string;
    targetDate: string;
    targetDateFormatted: string;
    analysisDays: number;
    forecastDays: number;
  };
  stats: {
    txCount: number;
    totalIncome: number;
    totalExpense: number;
    netBurn: number;
    dailyExpenseAvg: number;
    dailyIncomeAvg: number;
    dailyNetBurnAvg: number;
    safeDailySpendingAllowance: number;
  };
  expectedIncome: number;
  customQuestion?: string;
  upcoming: {
    totalExpenses: number;
    totalIncomes: number;
    expensesList: UpcomingItem[];
    incomesList: UpcomingItem[];
    items: UpcomingItem[];
  };
  categoryReport: CategoryReportItem[];
  budgetSummary: {
    totalBudget: number;
    totalSpentInBudgeted: number;
    budgetUtilizationPercent: number;
    categoriesOverBudget: number;
    categoriesNearLimit: number;
    categoriesSafe: number;
  };
  categories: Array<{
    id: string;
    name: string;
    color: string;
    amount: number;
    percent: number;
    count: number;
  }>;
  anomalies: Array<{
    id: string;
    amount: number;
    description: string;
    date: string;
    categoryName: string;
  }>;
  historicalSalary: {
    amount: number;
    description: string;
    companyName: string;
    lastReceivedDate: string;
  };
  projections: {
    baseline: ProjectionScenario;
    optimized: ProjectionScenario;
    conservative: ProjectionScenario;
  };
  aiAnalysis: GeminiAnalysisResult;
  savedAt?: string;
}

export interface AnalyticsConfig {
  account: {
    id: string;
    displayName: string;
    accountNumber: string;
    balance: number;
    totalCash: number;
  };
  detectedSalary: number;
  defaults: {
    startDate: string;
    endDate: string;
    targetDate: string;
    expectedIncome: number;
    customQuestion: string;
  };
  suggestedUpcomingItems: UpcomingItem[];
  latestAnalysis?: ForecastResponse | null;
}
