import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService, GeminiAnalysisResult } from './gemini.service';
import { TransactionDirection } from '@prisma/client';
import Decimal from 'decimal.js';

export interface UpcomingItem {
  id: string;
  name: string;
  amount: number;
  type: 'EXPENSE' | 'INCOME';
  dueDate: string; // YYYY-MM-DD
  enabled: boolean;
  category?: string;
  isQuickPreset?: boolean;
}

export interface AnalyzeOptions {
  startDate?: string;
  endDate?: string;
  targetDate?: string;
  expectedIncome?: number;
  customQuestion?: string;
  accountId?: string;
  upcomingItems?: UpcomingItem[];
}

export interface MarkdownReportOptions {
  startDate?: string;
  endDate?: string;
  includeTransactions?: boolean;
  includeUpcoming?: boolean;
  includeSavings?: boolean;
  includePrompt?: boolean;
  targetDate?: string;
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
  isDebt?: boolean;
}

export function isDebtExpenseCategory(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  return n === 'cho vay' || n.includes('cho vay') || n.includes('cho mượn');
}

export function isDebtIncomeCategory(name?: string | null): boolean {
  if (!name) return false;
  const n = name.toLowerCase().trim();
  return (
    n === 'thu hồi nợ' ||
    n.includes('thu hồi nợ') ||
    n.includes('thu nợ') ||
    n.includes('đòi nợ')
  );
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
    livingExpense?: number;
    livingIncome?: number;
    debtLentTotal?: number;
    debtRecoveredTotal?: number;
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
    baseline: {
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
      status: 'SAFE' | 'WARNING' | 'DANGER';
    };
    optimized: {
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
      status: 'EXCELLENT';
    };
    conservative: {
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
      status: 'CAUTION';
    };
  };
  aiAnalysis: GeminiAnalysisResult;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  /**
   * Pre-loads default parameters, detected salary, and recurring milestone items directly
   * from the user's database without creating duplicates.
   */
  async getInitialConfig(userId: string) {
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIsoDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Primary account
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
    });
    const primaryAccount = accounts.find((a) =>
      a.accountNumber?.includes('1468651509999'),
    ) ||
      accounts[0] || {
        id: 'default',
        displayName: 'MB Bank',
        accountNumber: '1468651509999',
        balance: 0,
      };

    let totalCash = 0;
    for (const a of accounts) {
      totalCash += Number(a.balance);
    }

    // Check user recurring obligations and salary from DB
    const dbRecurring = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
    });

    const recurringSalary = dbRecurring.find(
      (r) => r.direction === TransactionDirection.INCOME,
    );
    const latestSalaryTx = await this.prisma.transaction.findFirst({
      where: {
        userId,
        direction: TransactionDirection.INCOME,
        amount: { gte: 10000000 },
      },
      orderBy: { transactionDate: 'desc' },
    });

    const detectedSalaryAmount = recurringSalary
      ? Number(recurringSalary.amount)
      : latestSalaryTx
        ? Number(latestSalaryTx.amount)
        : 20300000;

    // Default dates:
    let startD: Date;
    if (now.getDate() >= 10) {
      startD = new Date(currentYear, currentMonth, 10);
    } else {
      startD = new Date(now);
      startD.setDate(startD.getDate() - 7);
    }
    const endD = new Date(now);

    // Target date: 10th of next month
    let targetD: Date;
    if (now.getDate() >= 10) {
      targetD = new Date(currentYear, currentMonth + 1, 10);
    } else {
      targetD = new Date(currentYear, currentMonth, 10);
    }

    const nextMonth = now.getDate() >= 10 ? currentMonth + 1 : currentMonth;
    const rentMonth = now.getDate() >= 10 ? currentMonth + 1 : currentMonth;

    const suggestedUpcomingItems: UpcomingItem[] = [];

    // 1. Load actual recurring expenses from the user's DB (e.g. Tiền thuê nhà định kỳ 7tr)
    let hasRentInDb = false;
    for (const r of dbRecurring) {
      if (r.direction === TransactionDirection.EXPENSE) {
        const isRent =
          r.name.toLowerCase().includes('nhà') ||
          r.name.toLowerCase().includes('phòng');
        if (isRent) hasRentInDb = true;
        const day = r.dayOfMonth || 5;
        const dueDate = `${currentYear}-${pad(rentMonth + 1)}-${pad(day)}`;
        suggestedUpcomingItems.push({
          id: `db_${r.id}`,
          name: isRent ? `🏠 ${r.name}` : r.name,
          amount: Number(r.amount),
          type: 'EXPENSE',
          dueDate,
          enabled: true,
          category: isRent ? 'Thuê nhà' : 'Khoản định kỳ',
          isQuickPreset: isRent,
        });
      }
    }

    // If user has NO rent item in DB, suggest one based on standard
    if (!hasRentInDb) {
      suggestedUpcomingItems.push({
        id: 'rent_custom',
        name: '🏠 Tiền thuê nhà định kỳ',
        amount: 7000000,
        type: 'EXPENSE',
        dueDate: `${currentYear}-${pad(rentMonth + 1)}-05`,
        enabled: true,
        category: 'Thuê nhà',
        isQuickPreset: true,
      });
    }

    return {
      account: {
        id: primaryAccount.id,
        displayName: primaryAccount.displayName,
        accountNumber: primaryAccount.accountNumber || '',
        balance: Number(primaryAccount.balance),
        totalCash,
      },
      detectedSalary: detectedSalaryAmount,
      defaults: {
        startDate: toIsoDate(startD),
        endDate: toIsoDate(endD),
        targetDate: toIsoDate(targetD),
        expectedIncome: detectedSalaryAmount,
        customQuestion: '',
      },
      suggestedUpcomingItems,
      latestAnalysis: await this.getLatestAnalysisFromDb(userId),
    };
  }

  /**
   * Run comprehensive analysis, Category Budget Report, and AI projections
   */
  async analyze(
    userId: string,
    options: AnalyzeOptions = {},
  ): Promise<ForecastResponse> {
    const now = new Date();

    // 1. Resolve Dates
    let startD: Date;
    let endD: Date;
    let targetD: Date;

    if (options.startDate) {
      startD = new Date(options.startDate);
      startD.setHours(0, 0, 0, 0);
    } else {
      startD = new Date(now);
      startD.setDate(startD.getDate() - 7);
      startD.setHours(0, 0, 0, 0);
    }

    if (options.endDate) {
      endD = new Date(options.endDate);
      endD.setHours(23, 59, 59, 999);
    } else {
      endD = new Date(now);
    }

    if (options.targetDate) {
      targetD = new Date(options.targetDate);
      targetD.setHours(23, 59, 59, 999);
    } else {
      targetD = new Date(now);
      targetD.setDate(targetD.getDate() + 24);
      targetD.setHours(23, 59, 59, 999);
    }

    if (
      isNaN(startD.getTime()) ||
      isNaN(endD.getTime()) ||
      isNaN(targetD.getTime())
    ) {
      throw new BadRequestException('Ngày tháng cung cấp không hợp lệ');
    }

    if (startD > endD) {
      throw new BadRequestException('Ngày bắt đầu không thể sau ngày kết thúc');
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const analysisDays = Math.max(
      1,
      Math.round((endD.getTime() - startD.getTime()) / msPerDay),
    );
    const forecastDays = Math.max(
      1,
      Math.round((targetD.getTime() - endD.getTime()) / msPerDay),
    );

    // 2. Query Accounts
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        isActive: true,
        ...(options.accountId ? { id: options.accountId } : {}),
      },
    });

    const primaryAccount = accounts.find((a) =>
      a.accountNumber?.includes('1468651509999'),
    ) ||
      accounts[0] || {
        id: 'default',
        displayName: 'MB Bank',
        accountNumber: '1468651509999',
        balance: 0,
      };

    let totalCashDecimal = new Decimal(0);
    for (const acc of accounts) {
      totalCashDecimal = totalCashDecimal.plus(
        new Decimal(acc.balance.toString()),
      );
    }
    const currentBalance = new Decimal(
      primaryAccount.balance.toString(),
    ).toNumber();
    const totalCash = totalCashDecimal.toNumber();

    // 3. Query Transactions in the user's selected date range [startD, endD]
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        isInternalTransfer: false,
        transactionDate: {
          gte: startD,
          lte: endD,
        },
        ...(options.accountId ? { accountId: options.accountId } : {}),
      },
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    // 4. Compute Totals & Categorical Breakdown (Separating living expenses vs debt/loans)
    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    let livingIncome = new Decimal(0);
    let livingExpense = new Decimal(0);
    let debtLentTotal = new Decimal(0);
    let debtRecoveredTotal = new Decimal(0);

    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        amount: Decimal;
        count: number;
        isDebt: boolean;
      }
    >();
    const anomalies: any[] = [];

    for (const tx of transactions) {
      const amt = new Decimal(tx.amount.toString());
      const catId = tx.categoryId || 'uncategorized';
      const catName = tx.category?.name || 'Chưa phân loại';
      const catColor = tx.category?.color || '#64748b';

      if (tx.direction === TransactionDirection.INCOME) {
        totalIncome = totalIncome.plus(amt);
        if (isDebtIncomeCategory(catName)) {
          debtRecoveredTotal = debtRecoveredTotal.plus(amt);
        } else {
          livingIncome = livingIncome.plus(amt);
        }
      } else if (tx.direction === TransactionDirection.EXPENSE) {
        totalExpense = totalExpense.plus(amt);
        const isDebt = isDebtExpenseCategory(catName);
        if (isDebt) {
          debtLentTotal = debtLentTotal.plus(amt);
        } else {
          livingExpense = livingExpense.plus(amt);
        }

        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: catName,
            color: catColor,
            amount: new Decimal(0),
            count: 0,
            isDebt,
          });
        }
        const existing = categoryMap.get(catId)!;
        existing.amount = existing.amount.plus(amt);
        existing.count += 1;

        if (amt.greaterThanOrEqualTo(500000)) {
          anomalies.push({
            id: tx.id,
            amount: amt.toNumber(),
            description: tx.description,
            date: tx.transactionDate.toISOString().slice(0, 10),
            categoryName: catName,
            isDebt,
          });
        }
      }
    }

    const totalExpenseNum = totalExpense.toNumber();
    const totalIncomeNum = totalIncome.toNumber();
    const livingExpenseNum = livingExpense.toNumber();
    const livingIncomeNum = livingIncome.toNumber();
    const netBurnNum = livingExpense.minus(livingIncome).toNumber();

    // Burn rate reflects REAL consumer/living expenses, excluding lent loans
    const dailyExpenseAvg = Math.round(livingExpenseNum / analysisDays);
    const dailyIncomeAvg = Math.round(livingIncomeNum / analysisDays);
    const dailyNetBurnAvg = Math.max(0, Math.round(netBurnNum / analysisDays));

    const categoriesList = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: c.amount.toNumber(),
        percent:
          livingExpenseNum > 0
            ? Math.round(
                (c.amount.toNumber() /
                  (c.isDebt ? totalExpenseNum : livingExpenseNum)) *
                  100,
              )
            : 0,
        count: c.count,
        isDebt: c.isDebt,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 5. Query User's Established Budgets to produce Category Budget Report
    const userBudgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    });

    const budgetMapByCategoryId = new Map<string, number>();
    const budgetMapByName = new Map<string, number>();

    for (const b of userBudgets) {
      const amt = Number(b.amount);
      if (b.categoryId) {
        budgetMapByCategoryId.set(
          b.categoryId,
          (budgetMapByCategoryId.get(b.categoryId) || 0) + amt,
        );
      }
      if (b.category?.name) {
        budgetMapByName.set(b.category.name.toLowerCase().trim(), amt);
      }
      budgetMapByName.set(b.name.toLowerCase().trim(), amt);
    }

    const categoryReport: CategoryReportItem[] = [];
    let totalBudgetSum = 0;
    let totalSpentInBudgetedSum = 0;
    let categoriesOverBudgetCount = 0;
    let categoriesNearLimitCount = 0;
    let categoriesSafeCount = 0;

    for (const cat of categoriesList) {
      const budgetAmount =
        budgetMapByCategoryId.get(cat.id) ||
        budgetMapByName.get(cat.name.toLowerCase().trim()) ||
        0;

      const spent = cat.amount;
      let status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' =
        'NO_BUDGET';
      let percentOfBudget = 0;
      let remainingBudget: number | null = null;

      if (budgetAmount > 0) {
        totalBudgetSum += budgetAmount;
        totalSpentInBudgetedSum += spent;
        percentOfBudget = Math.round((spent / budgetAmount) * 100);
        remainingBudget = Math.max(0, budgetAmount - spent);

        if (percentOfBudget > 100) {
          status = 'OVER_BUDGET';
          categoriesOverBudgetCount++;
        } else if (percentOfBudget >= 80) {
          status = 'NEAR_LIMIT';
          categoriesNearLimitCount++;
        } else {
          status = 'SAFE';
          categoriesSafeCount++;
        }
      }

      categoryReport.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        spent,
        percentOfTotal: cat.percent,
        txCount: cat.count,
        dailyAverage: Math.round(spent / analysisDays),
        budgetAmount,
        remainingBudget,
        percentOfBudget,
        status,
      });
    }

    // Also include any budgeted categories that had 0 spending in this period
    for (const b of userBudgets) {
      const bCatId = b.categoryId || b.id;
      const bCatName = b.category?.name || b.name;
      const alreadyIncluded = categoryReport.some(
        (c) =>
          c.id === bCatId || c.name.toLowerCase() === bCatName.toLowerCase(),
      );

      if (!alreadyIncluded) {
        const bAmt = Number(b.amount);
        totalBudgetSum += bAmt;
        categoriesSafeCount++;
        categoryReport.push({
          id: bCatId,
          name: bCatName,
          color: b.category?.color || '#94a3b8',
          spent: 0,
          percentOfTotal: 0,
          txCount: 0,
          dailyAverage: 0,
          budgetAmount: bAmt,
          remainingBudget: bAmt,
          percentOfBudget: 0,
          status: 'SAFE',
        });
      }
    }

    const budgetSummary = {
      totalBudget: totalBudgetSum,
      totalSpentInBudgeted: totalSpentInBudgetedSum,
      budgetUtilizationPercent:
        totalBudgetSum > 0
          ? Math.round((totalSpentInBudgetedSum / totalBudgetSum) * 100)
          : 0,
      categoriesOverBudget: categoriesOverBudgetCount,
      categoriesNearLimit: categoriesNearLimitCount,
      categoriesSafe: categoriesSafeCount,
    };

    // 6. Query Historical Salary Patterns
    const recentSalaries = await this.prisma.transaction.findMany({
      where: {
        userId,
        direction: TransactionDirection.INCOME,
        amount: { gte: 10000000 },
      },
      orderBy: { transactionDate: 'desc' },
      take: 5,
    });

    const latestSalary = recentSalaries[0];
    const detectedSalaryAmount = latestSalary
      ? new Decimal(latestSalary.amount.toString()).toNumber()
      : 20300000;
    const historicalSalaryDesc = latestSalary
      ? latestSalary.description
      : 'CT TNHH Phat trien nguon nhan luc Gina Viet Nam';

    const expectedIncome =
      options.expectedIncome !== undefined
        ? Number(options.expectedIncome)
        : detectedSalaryAmount;

    // 7. Handle Upcoming Planned Items
    const rawUpcoming = options.upcomingItems || [];
    const enabledUpcoming = rawUpcoming.filter((item) => item.enabled === true);

    let totalUpcomingExpenses = 0;
    let totalUpcomingIncomes = 0;
    const expensesList: UpcomingItem[] = [];
    const incomesList: UpcomingItem[] = [];

    for (const item of enabledUpcoming) {
      const itemDue = new Date(item.dueDate);
      itemDue.setHours(23, 59, 59, 999);

      if (itemDue <= targetD) {
        const amt = Number(item.amount) || 0;
        if (item.type === 'EXPENSE') {
          totalUpcomingExpenses += amt;
          expensesList.push(item);
        } else {
          totalUpcomingIncomes += amt;
          incomesList.push(item);
        }
      }
    }

    const reserveNeeded = Math.max(
      0,
      totalUpcomingExpenses - totalUpcomingIncomes,
    );
    const availableForLiving = Math.max(0, currentBalance - reserveNeeded);
    const safeDailySpendingAllowance = Math.max(
      0,
      Math.round(availableForLiving / forecastDays),
    );

    // 8. Calculate Projections
    const baselineDailyBurn =
      dailyNetBurnAvg > 0 ? dailyNetBurnAvg : dailyExpenseAvg;
    const baselineRegularExpense = baselineDailyBurn * forecastDays;
    const baselineProjectedExpense =
      baselineRegularExpense + totalUpcomingExpenses;
    const baselineBalanceBefore =
      currentBalance -
      baselineRegularExpense -
      totalUpcomingExpenses +
      totalUpcomingIncomes;
    const baselineBalanceAfter = baselineBalanceBefore + expectedIncome;

    let anomalyTotal = new Decimal(0);
    for (const a of anomalies) {
      if (!a.isDebt && a.amount >= 500000) {
        anomalyTotal = anomalyTotal.plus(a.amount);
      }
    }
    const regularExpense = Decimal.max(
      0,
      livingExpense.minus(anomalyTotal),
    ).toNumber();
    const optimizedDailyBurn = Math.max(
      100000,
      Math.round(Math.max(0, regularExpense - livingIncomeNum) / analysisDays),
    );
    const optimizedRegularExpense = optimizedDailyBurn * forecastDays;
    const optimizedProjectedExpense =
      optimizedRegularExpense + totalUpcomingExpenses;
    const optimizedBalanceBefore =
      currentBalance -
      optimizedRegularExpense -
      totalUpcomingExpenses +
      totalUpcomingIncomes;
    const optimizedBalanceAfter = optimizedBalanceBefore + expectedIncome;

    const conservativeDailyBurn = Math.max(
      500000,
      Math.round(baselineDailyBurn * 1.35),
    );
    const conservativeRegularExpense = conservativeDailyBurn * forecastDays;
    const conservativeProjectedExpense =
      conservativeRegularExpense + totalUpcomingExpenses;
    const conservativeBalanceBefore = Math.max(
      0,
      currentBalance -
        conservativeRegularExpense -
        totalUpcomingExpenses +
        totalUpcomingIncomes,
    );
    const conservativeBalanceAfter = conservativeBalanceBefore + expectedIncome;

    const context = {
      account: {
        displayName: primaryAccount.displayName,
        accountNumber: primaryAccount.accountNumber,
        balance: currentBalance,
      },
      timeframe: {
        startDateFormatted: startD.toLocaleDateString('vi-VN'),
        endDateFormatted: endD.toLocaleDateString('vi-VN'),
        targetDateFormatted: targetD.toLocaleDateString('vi-VN'),
        analysisDays,
        forecastDays,
      },
      stats: {
        txCount: transactions.length,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        livingExpense: livingExpenseNum,
        livingIncome: livingIncomeNum,
        debtLentTotal: debtLentTotal.toNumber(),
        debtRecoveredTotal: debtRecoveredTotal.toNumber(),
        netBurn: netBurnNum,
        dailyExpenseAvg,
        dailyIncomeAvg,
        dailyNetBurnAvg,
        safeDailySpendingAllowance,
      },
      expectedIncome,
      customQuestion: options.customQuestion?.trim() || undefined,
      upcoming: {
        totalExpenses: totalUpcomingExpenses,
        totalIncomes: totalUpcomingIncomes,
        expensesList,
        incomesList,
      },
      categories: categoriesList,
      categoryReport,
      budgetSummary,
      anomalies,
      projections: {
        baseline: {
          projectedExpense: baselineProjectedExpense,
          projectedBalanceBeforeSalary: baselineBalanceBefore,
          projectedBalanceAfterSalary: baselineBalanceAfter,
          projectedBalanceBeforeSalaryFormatted: `${baselineBalanceBefore.toLocaleString('vi-VN')} đ`,
        },
        optimized: {
          projectedExpense: optimizedProjectedExpense,
          projectedBalanceBeforeSalary: optimizedBalanceBefore,
          projectedBalanceAfterSalary: optimizedBalanceAfter,
        },
        conservative: {
          projectedExpense: conservativeProjectedExpense,
          projectedBalanceBeforeSalary: conservativeBalanceBefore,
          projectedBalanceAfterSalary: conservativeBalanceAfter,
        },
      },
    };

    // 9. Call Gemini AI (using strictly locked models gemini-3.6-flash & gemini-3.8-flash)
    const aiAnalysis = await this.geminiService.analyzeFinancialData(context);

    const result: ForecastResponse = {
      account: {
        id: primaryAccount.id,
        displayName: primaryAccount.displayName,
        accountNumber: primaryAccount.accountNumber || '',
        balance: currentBalance,
        totalCash,
      },
      timeframe: {
        startDate: startD.toISOString().slice(0, 10),
        startDateFormatted: startD.toLocaleDateString('vi-VN'),
        endDate: endD.toISOString().slice(0, 10),
        endDateFormatted: endD.toLocaleDateString('vi-VN'),
        targetDate: targetD.toISOString().slice(0, 10),
        targetDateFormatted: targetD.toLocaleDateString('vi-VN'),
        analysisDays,
        forecastDays,
      },
      stats: {
        txCount: transactions.length,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        livingExpense: livingExpenseNum,
        livingIncome: livingIncomeNum,
        debtLentTotal: debtLentTotal.toNumber(),
        debtRecoveredTotal: debtRecoveredTotal.toNumber(),
        netBurn: netBurnNum,
        dailyExpenseAvg,
        dailyIncomeAvg,
        dailyNetBurnAvg,
        safeDailySpendingAllowance,
      },
      expectedIncome,
      customQuestion: options.customQuestion?.trim() || undefined,
      upcoming: {
        totalExpenses: totalUpcomingExpenses,
        totalIncomes: totalUpcomingIncomes,
        expensesList,
        incomesList,
        items: rawUpcoming,
      },
      categoryReport,
      budgetSummary,
      categories: categoriesList,
      anomalies,
      historicalSalary: {
        amount: detectedSalaryAmount,
        description: historicalSalaryDesc,
        companyName: 'Gina Việt Nam',
        lastReceivedDate: latestSalary
          ? latestSalary.transactionDate.toISOString().slice(0, 10)
          : '',
      },
      projections: {
        baseline: {
          label: 'Kịch bản cơ sở (Duy trì tốc độ thực tế)',
          description: `Bình quân tiêu hao sinh hoạt ${baselineDailyBurn.toLocaleString('vi-VN')} đ/ngày + ${totalUpcomingExpenses.toLocaleString('vi-VN')} đ chi dự kiến`,
          dailyBurn: baselineDailyBurn,
          regularProjectedExpense: baselineRegularExpense,
          upcomingExpense: totalUpcomingExpenses,
          projectedExpense: baselineProjectedExpense,
          projectedBalanceBeforeSalary: baselineBalanceBefore,
          projectedBalanceAfterSalary: baselineBalanceAfter,
          projectedBalanceBeforeSalaryFormatted: `${baselineBalanceBefore.toLocaleString('vi-VN')} đ`,
          projectedBalanceAfterSalaryFormatted: `${baselineBalanceAfter.toLocaleString('vi-VN')} đ`,
          status: baselineBalanceBefore > 2000000 ? 'SAFE' : 'WARNING',
        },
        optimized: {
          label: 'Kịch bản tối ưu (Tiết kiệm, kiểm soát chặt)',
          description: `Tiêu hao sinh hoạt ${optimizedDailyBurn.toLocaleString('vi-VN')} đ/ngày + ${totalUpcomingExpenses.toLocaleString('vi-VN')} đ chi dự kiến`,
          dailyBurn: optimizedDailyBurn,
          regularProjectedExpense: optimizedRegularExpense,
          upcomingExpense: totalUpcomingExpenses,
          projectedExpense: optimizedProjectedExpense,
          projectedBalanceBeforeSalary: optimizedBalanceBefore,
          projectedBalanceAfterSalary: optimizedBalanceAfter,
          projectedBalanceBeforeSalaryFormatted: `${optimizedBalanceBefore.toLocaleString('vi-VN')} đ`,
          projectedBalanceAfterSalaryFormatted: `${optimizedBalanceAfter.toLocaleString('vi-VN')} đ`,
          status: 'EXCELLENT',
        },
        conservative: {
          label: 'Kịch bản thận trọng (Chi tiêu tăng cao cuối kỳ)',
          description: `Dự phòng phát sinh sinh hoạt ~${conservativeDailyBurn.toLocaleString('vi-VN')} đ/ngày + ${totalUpcomingExpenses.toLocaleString('vi-VN')} đ chi dự kiến`,
          dailyBurn: conservativeDailyBurn,
          regularProjectedExpense: conservativeRegularExpense,
          upcomingExpense: totalUpcomingExpenses,
          projectedExpense: conservativeProjectedExpense,
          projectedBalanceBeforeSalary: conservativeBalanceBefore,
          projectedBalanceAfterSalary: conservativeBalanceAfter,
          projectedBalanceBeforeSalaryFormatted: `${conservativeBalanceBefore.toLocaleString('vi-VN')} đ`,
          projectedBalanceAfterSalaryFormatted: `${conservativeBalanceAfter.toLocaleString('vi-VN')} đ`,
          status: 'CAUTION',
        },
      },
      aiAnalysis,
    };

    // Save JSON result directly into PostgreSQL DB (system_settings)
    try {
      await this.prisma.systemSetting.upsert({
        where: {
          userId_key: {
            userId,
            key: 'LATEST_AI_FORECAST_RESULT',
          },
        },
        create: {
          userId,
          key: 'LATEST_AI_FORECAST_RESULT',
          value: JSON.stringify(result),
        },
        update: {
          value: JSON.stringify(result),
          updatedAt: new Date(),
        },
      });
      this.logger.log(
        `Saved latest AI forecast result to DB for user ${userId}`,
      );
    } catch (err) {
      this.logger.error('Failed to save AI forecast result to DB', err);
    }

    return result;
  }

  /**
   * Load the most recently saved AI analysis result JSON directly from the DB.
   */
  async getLatestAnalysisFromDb(userId: string) {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: {
          userId_key: {
            userId,
            key: 'LATEST_AI_FORECAST_RESULT',
          },
        },
      });

      if (!setting || !setting.value) {
        return null;
      }

      const parsed = JSON.parse(setting.value);
      if (parsed.upcoming?.items && Array.isArray(parsed.upcoming.items)) {
        parsed.upcoming.items = parsed.upcoming.items.filter(
          (item: any) =>
            !item.id?.toLowerCase().includes('20_10') &&
            !item.name?.toLowerCase().includes('20/10'),
        );
      }
      if (parsed.customQuestion && parsed.customQuestion.includes('20/10')) {
        parsed.customQuestion = '';
      }

      return {
        ...parsed,
        savedAt: setting.updatedAt,
      };
    } catch (err) {
      this.logger.error(
        'Failed to read latest AI forecast result from DB',
        err,
      );
      return null;
    }
  }

  /**
   * Fast, real-time Category Budget Report for a selected historical period.
   * Does NOT call Gemini AI, calculates instantaneously from DB transactions & budgets.
   */
  async getCategoryReport(
    userId: string,
    startDate?: string,
    endDate?: string,
  ) {
    const now = new Date();
    let startD: Date;
    let endD: Date;

    if (startDate) {
      startD = new Date(startDate);
      startD.setHours(0, 0, 0, 0);
    } else {
      if (now.getDate() >= 10) {
        startD = new Date(now.getFullYear(), now.getMonth(), 10);
      } else {
        startD = new Date(now);
        startD.setDate(startD.getDate() - 7);
      }
      startD.setHours(0, 0, 0, 0);
    }

    if (endDate) {
      endD = new Date(endDate);
      endD.setHours(23, 59, 59, 999);
    } else {
      endD = new Date(now);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const analysisDays = Math.max(
      1,
      Math.round((endD.getTime() - startD.getTime()) / msPerDay),
    );

    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        isInternalTransfer: false,
        transactionDate: {
          gte: startD,
          lte: endD,
        },
      },
      include: {
        category: true,
      },
      orderBy: {
        transactionDate: 'desc',
      },
    });

    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    let livingIncome = new Decimal(0);
    let livingExpense = new Decimal(0);
    let debtLentTotal = new Decimal(0);
    let debtRecoveredTotal = new Decimal(0);

    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        color: string;
        amount: Decimal;
        count: number;
        isDebt: boolean;
      }
    >();
    const anomalies: any[] = [];

    for (const tx of transactions) {
      const amt = new Decimal(tx.amount.toString());
      const catId = tx.categoryId || 'uncategorized';
      const catName = tx.category?.name || 'Chưa phân loại';
      const catColor = tx.category?.color || '#64748b';

      if (tx.direction === TransactionDirection.INCOME) {
        totalIncome = totalIncome.plus(amt);
        if (isDebtIncomeCategory(catName)) {
          debtRecoveredTotal = debtRecoveredTotal.plus(amt);
        } else {
          livingIncome = livingIncome.plus(amt);
        }
      } else if (tx.direction === TransactionDirection.EXPENSE) {
        totalExpense = totalExpense.plus(amt);
        const isDebt = isDebtExpenseCategory(catName);
        if (isDebt) {
          debtLentTotal = debtLentTotal.plus(amt);
        } else {
          livingExpense = livingExpense.plus(amt);
        }

        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: catName,
            color: catColor,
            amount: new Decimal(0),
            count: 0,
            isDebt,
          });
        }
        const existing = categoryMap.get(catId)!;
        existing.amount = existing.amount.plus(amt);
        existing.count += 1;

        if (amt.greaterThanOrEqualTo(500000)) {
          anomalies.push({
            id: tx.id,
            amount: amt.toNumber(),
            description: tx.description,
            date: tx.transactionDate.toISOString().slice(0, 10),
            categoryName: catName,
            isDebt,
          });
        }
      }
    }

    const totalExpenseNum = totalExpense.toNumber();
    const totalIncomeNum = totalIncome.toNumber();
    const livingExpenseNum = livingExpense.toNumber();
    const livingIncomeNum = livingIncome.toNumber();
    const netBurnNum = livingExpense.minus(livingIncome).toNumber();

    const dailyExpenseAvg = Math.round(livingExpenseNum / analysisDays);
    const dailyIncomeAvg = Math.round(livingIncomeNum / analysisDays);
    const dailyNetBurnAvg = Math.max(0, Math.round(netBurnNum / analysisDays));

    const categoriesList = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: c.amount.toNumber(),
        percent:
          livingExpenseNum > 0
            ? Math.round(
                (c.amount.toNumber() /
                  (c.isDebt ? totalExpenseNum : livingExpenseNum)) *
                  100,
              )
            : 0,
        count: c.count,
        isDebt: c.isDebt,
      }))
      .sort((a, b) => b.amount - a.amount);

    const userBudgets = await this.prisma.budget.findMany({
      where: { userId, isActive: true },
      include: { category: true },
    });

    const budgetMapByCategoryId = new Map<string, number>();
    const budgetMapByName = new Map<string, number>();

    for (const b of userBudgets) {
      const amt = Number(b.amount);
      if (b.categoryId) {
        budgetMapByCategoryId.set(
          b.categoryId,
          (budgetMapByCategoryId.get(b.categoryId) || 0) + amt,
        );
      }
      if (b.category?.name) {
        budgetMapByName.set(b.category.name.toLowerCase().trim(), amt);
      }
      budgetMapByName.set(b.name.toLowerCase().trim(), amt);
    }

    const categoryReport: CategoryReportItem[] = [];
    let totalBudgetSum = 0;
    let totalSpentInBudgetedSum = 0;
    let categoriesOverBudgetCount = 0;
    let categoriesNearLimitCount = 0;
    let categoriesSafeCount = 0;

    for (const cat of categoriesList) {
      const budgetAmount =
        budgetMapByCategoryId.get(cat.id) ||
        budgetMapByName.get(cat.name.toLowerCase().trim()) ||
        0;

      const spent = cat.amount;
      let status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' =
        'NO_BUDGET';
      let percentOfBudget = 0;
      let remainingBudget: number | null = null;

      if (budgetAmount > 0) {
        totalBudgetSum += budgetAmount;
        totalSpentInBudgetedSum += spent;
        percentOfBudget = Math.round((spent / budgetAmount) * 100);
        remainingBudget = Math.max(0, budgetAmount - spent);

        if (percentOfBudget > 100) {
          status = 'OVER_BUDGET';
          categoriesOverBudgetCount++;
        } else if (percentOfBudget >= 80) {
          status = 'NEAR_LIMIT';
          categoriesNearLimitCount++;
        } else {
          status = 'SAFE';
          categoriesSafeCount++;
        }
      }

      categoryReport.push({
        id: cat.id,
        name: cat.name,
        color: cat.color,
        spent,
        percentOfTotal: cat.percent,
        txCount: cat.count,
        dailyAverage: Math.round(spent / analysisDays),
        budgetAmount,
        remainingBudget,
        percentOfBudget,
        status,
      });
    }

    // Include budgeted categories with 0 spent
    for (const b of userBudgets) {
      const bCatId = b.categoryId || b.id;
      const bCatName = b.category?.name || b.name;
      const alreadyIncluded = categoryReport.some(
        (c) =>
          c.id === bCatId || c.name.toLowerCase() === bCatName.toLowerCase(),
      );

      if (!alreadyIncluded) {
        const bAmt = Number(b.amount);
        totalBudgetSum += bAmt;
        categoriesSafeCount++;
        categoryReport.push({
          id: bCatId,
          name: bCatName,
          color: b.category?.color || '#94a3b8',
          spent: 0,
          percentOfTotal: 0,
          txCount: 0,
          dailyAverage: 0,
          budgetAmount: bAmt,
          remainingBudget: bAmt,
          percentOfBudget: 0,
          status: 'SAFE',
        });
      }
    }

    return {
      timeframe: {
        startDate: startD.toISOString().slice(0, 10),
        startDateFormatted: startD.toLocaleDateString('vi-VN'),
        endDate: endD.toISOString().slice(0, 10),
        endDateFormatted: endD.toLocaleDateString('vi-VN'),
        analysisDays,
      },
      stats: {
        txCount: transactions.length,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        livingExpense: livingExpenseNum,
        livingIncome: livingIncomeNum,
        debtLentTotal: debtLentTotal.toNumber(),
        debtRecoveredTotal: debtRecoveredTotal.toNumber(),
        netBurn: netBurnNum,
        dailyExpenseAvg,
        dailyIncomeAvg,
        dailyNetBurnAvg,
      },
      categoryReport,
      budgetSummary: {
        totalBudget: totalBudgetSum,
        totalSpentInBudgeted: totalSpentInBudgetedSum,
        budgetUtilizationPercent:
          totalBudgetSum > 0
            ? Math.round((totalSpentInBudgetedSum / totalBudgetSum) * 100)
            : 0,
        categoriesOverBudget: categoriesOverBudgetCount,
        categoriesNearLimit: categoriesNearLimitCount,
        categoriesSafe: categoriesSafeCount,
      },
      anomalies,
    };
  }

  /**
   * Generates a comprehensive, highly structured Markdown report for a given date range.
   * Specially designed for external AI analysis (e.g., Claude 3.5 Sonnet, ChatGPT, DeepSeek).
   */
  async generateMarkdownReport(
    userId: string,
    options: MarkdownReportOptions = {},
  ) {
    const now = new Date();
    let startD: Date;
    let endD: Date;

    const pad = (n: number) => n.toString().padStart(2, '0');
    const toIsoDate = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const toVnDate = (d: Date) =>
      `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
    const formatVND = (num: number) =>
      `${Math.round(num).toLocaleString('vi-VN')} VND`;

    if (options.startDate) {
      startD = new Date(options.startDate);
      startD.setHours(0, 0, 0, 0);
    } else {
      if (now.getDate() >= 10) {
        startD = new Date(now.getFullYear(), now.getMonth(), 10);
      } else {
        startD = new Date(now);
        startD.setDate(startD.getDate() - 7);
      }
      startD.setHours(0, 0, 0, 0);
    }

    if (options.endDate) {
      endD = new Date(options.endDate);
      endD.setHours(23, 59, 59, 999);
    } else {
      endD = new Date(now);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const analysisDays = Math.max(
      1,
      Math.round((endD.getTime() - startD.getTime()) / msPerDay),
    );
    const startDateFormatted = toVnDate(startD);
    const endDateFormatted = toVnDate(endD);
    const nowFormatted = `${toVnDate(now)} ${pad(now.getHours())}:${pad(now.getMinutes())}`;

    // 1. Fetch User & Accounts
    const [user, accounts, transactions, userBudgets, recurring, savings] =
      await Promise.all([
        this.prisma.user.findUnique({
          where: { id: userId },
          select: { name: true, email: true },
        }),
        this.prisma.account.findMany({
          where: { userId, isActive: true },
          orderBy: { balance: 'desc' },
        }),
        this.prisma.transaction.findMany({
          where: {
            userId,
            isInternalTransfer: false,
            transactionDate: {
              gte: startD,
              lte: endD,
            },
          },
          include: {
            category: true,
            account: true,
          },
          orderBy: {
            transactionDate: 'desc',
          },
        }),
        this.prisma.budget.findMany({
          where: { userId, isActive: true },
          include: { category: true },
        }),
        this.prisma.recurringTransaction.findMany({
          where: { userId, isActive: true },
          orderBy: { dayOfMonth: 'asc' },
        }),
        this.prisma.savingsGoal.findMany({
          where: { userId },
          orderBy: { targetDate: 'asc' },
        }),
      ]);

    let totalCash = 0;
    accounts.forEach((a) => {
      totalCash += Number(a.balance);
    });

    // 2. Aggregate Transactions
    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    let livingIncome = new Decimal(0);
    let livingExpense = new Decimal(0);
    let debtLentTotal = new Decimal(0);
    let debtRecoveredTotal = new Decimal(0);

    const categoryMap = new Map<
      string,
      {
        id: string;
        name: string;
        amount: Decimal;
        count: number;
        isDebt: boolean;
      }
    >();
    const anomalies: any[] = [];

    for (const tx of transactions) {
      const amt = new Decimal(tx.amount.toString());
      const catId = tx.categoryId || 'uncategorized';
      const catName = tx.category?.name || 'Chưa phân loại';

      if (tx.direction === TransactionDirection.INCOME) {
        totalIncome = totalIncome.plus(amt);
        if (isDebtIncomeCategory(catName)) {
          debtRecoveredTotal = debtRecoveredTotal.plus(amt);
        } else {
          livingIncome = livingIncome.plus(amt);
        }
      } else if (tx.direction === TransactionDirection.EXPENSE) {
        totalExpense = totalExpense.plus(amt);
        const isDebt = isDebtExpenseCategory(catName);
        if (isDebt) {
          debtLentTotal = debtLentTotal.plus(amt);
        } else {
          livingExpense = livingExpense.plus(amt);
        }

        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: catName,
            amount: new Decimal(0),
            count: 0,
            isDebt,
          });
        }
        const existing = categoryMap.get(catId)!;
        existing.amount = existing.amount.plus(amt);
        existing.count += 1;

        if (amt.greaterThanOrEqualTo(200000)) {
          anomalies.push({
            id: tx.id,
            amount: amt.toNumber(),
            description: tx.description,
            date: toVnDate(tx.transactionDate),
            categoryName: catName,
            accountName: tx.account?.displayName || 'Tài khoản',
            counterparty: tx.counterparty || '',
            isDebt,
          });
        }
      }
    }

    const totalExpenseNum = totalExpense.toNumber();
    const totalIncomeNum = totalIncome.toNumber();
    const livingExpenseNum = livingExpense.toNumber();
    const livingIncomeNum = livingIncome.toNumber();
    const debtLentNum = debtLentTotal.toNumber();
    const debtRecoveredNum = debtRecoveredTotal.toNumber();
    const netBurnNum = livingExpense.minus(livingIncome).toNumber();
    const netCashflowNum = totalIncome.minus(totalExpense).toNumber();

    const dailyExpenseAvg = Math.round(livingExpenseNum / analysisDays);
    const dailyIncomeAvg = Math.round(livingIncomeNum / analysisDays);
    const dailyNetBurnAvg = Math.max(0, Math.round(netBurnNum / analysisDays));
    const savingsRate =
      livingIncomeNum > 0
        ? Math.round(
            ((livingIncomeNum - livingExpenseNum) / livingIncomeNum) * 100,
          )
        : 0;

    // 3. Budgets & Categories
    const budgetMapByCategoryId = new Map<string, number>();
    const budgetMapByName = new Map<string, number>();

    for (const b of userBudgets) {
      const amt = Number(b.amount);
      if (b.categoryId) {
        budgetMapByCategoryId.set(
          b.categoryId,
          (budgetMapByCategoryId.get(b.categoryId) || 0) + amt,
        );
      }
      if (b.category?.name) {
        budgetMapByName.set(b.category.name.toLowerCase().trim(), amt);
      }
      budgetMapByName.set(b.name.toLowerCase().trim(), amt);
    }

    const categoriesList = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        amount: c.amount.toNumber(),
        percent:
          livingExpenseNum > 0
            ? Math.round(
                (c.amount.toNumber() /
                  (c.isDebt ? totalExpenseNum : livingExpenseNum)) *
                  100,
              )
            : 0,
        count: c.count,
        isDebt: c.isDebt,
      }))
      .sort((a, b) => b.amount - a.amount);

    let totalBudgetSum = 0;
    let totalSpentInBudgetedSum = 0;
    let categoriesOverBudgetCount = 0;
    let categoriesNearLimitCount = 0;
    let categoriesSafeCount = 0;

    const categoryRows: Array<{
      name: string;
      spent: number;
      percentOfTotal: number;
      txCount: number;
      dailyAvg: number;
      budgetAmount: number;
      percentOfBudget: number;
      remainingBudget: number | null;
      status: string;
      statusIcon: string;
    }> = [];

    for (const cat of categoriesList) {
      const budgetAmount =
        budgetMapByCategoryId.get(cat.id) ||
        budgetMapByName.get(cat.name.toLowerCase().trim()) ||
        0;

      const spent = cat.amount;
      let status = 'Chưa đặt ngân sách';
      let statusIcon = '⚪';
      let percentOfBudget = 0;
      let remainingBudget: number | null = null;

      if (budgetAmount > 0) {
        totalBudgetSum += budgetAmount;
        totalSpentInBudgetedSum += spent;
        percentOfBudget = Math.round((spent / budgetAmount) * 100);
        remainingBudget = Math.max(0, budgetAmount - spent);

        if (percentOfBudget > 100) {
          status = `Vượt ${percentOfBudget}%`;
          statusIcon = '🔴';
          categoriesOverBudgetCount++;
        } else if (percentOfBudget >= 80) {
          status = `Cận giới hạn (${percentOfBudget}%)`;
          statusIcon = '🟡';
          categoriesNearLimitCount++;
        } else {
          status = `An toàn (${percentOfBudget}%)`;
          statusIcon = '🟢';
          categoriesSafeCount++;
        }
      }

      categoryRows.push({
        name: cat.name,
        spent,
        percentOfTotal: cat.percent,
        txCount: cat.count,
        dailyAvg: Math.round(spent / analysisDays),
        budgetAmount,
        percentOfBudget,
        remainingBudget,
        status,
        statusIcon,
      });
    }

    // Include budgeted categories with 0 spent
    for (const b of userBudgets) {
      const bCatId = b.categoryId || b.id;
      const bCatName = b.category?.name || b.name;
      const alreadyIncluded = categoryRows.some(
        (c) => c.name.toLowerCase() === bCatName.toLowerCase(),
      );

      if (!alreadyIncluded) {
        const bAmt = Number(b.amount);
        totalBudgetSum += bAmt;
        categoriesSafeCount++;
        categoryRows.push({
          name: bCatName,
          spent: 0,
          percentOfTotal: 0,
          txCount: 0,
          dailyAvg: 0,
          budgetAmount: bAmt,
          percentOfBudget: 0,
          remainingBudget: bAmt,
          status: 'An toàn (0%)',
          statusIcon: '🟢',
        });
      }
    }

    const budgetUtilizationPercent =
      totalBudgetSum > 0
        ? Math.round((totalSpentInBudgetedSum / totalBudgetSum) * 100)
        : 0;

    // 4. Construct Markdown Document
    const lines: string[] = [];

    lines.push(`# 📊 BÁO CÁO TÀI CHÍNH CÁ NHÂN & DÒNG TIỀN (CASHFLOW REPORT)`);
    lines.push(
      `> **Nền tảng**: Hệ thống Quản lý Tài chính Thông minh Cashflow`,
    );
    lines.push(
      `> **Kỳ báo cáo**: Từ ngày ${startDateFormatted} đến ngày ${endDateFormatted} (${analysisDays} ngày)`,
    );
    lines.push(`> **Thời điểm xuất báo cáo**: ${nowFormatted}`);
    lines.push(
      `> **Chủ tài khoản**: ${user?.name || user?.email || 'Người dùng'}`,
    );
    lines.push('');

    // Optional Prompt for External AI
    if (options.includePrompt !== false) {
      lines.push(`---`);
      lines.push('');
      lines.push(`## 🤖 HƯỚNG DẪN / PROMPT CHO AI PHÂN TÍCH (SYSTEM PROMPT)`);
      lines.push(
        `> Bạn có thể sao chép toàn bộ báo cáo này hoặc đoạn prompt dưới đây rồi dán vào Claude, ChatGPT, DeepSeek để nhận phân tích chuyên sâu:`,
      );
      lines.push('');
      lines.push('```text');
      lines.push(
        `Bạn là một Chuyên gia Cố vấn Quản lý Tài chính Cá nhân Cấp cao (Senior Personal Finance Advisor & Wealth Coach).`,
      );
      lines.push(
        `Dưới đây là Báo cáo Dữ liệu Tài chính & Dòng tiền thực tế của tôi từ ngày ${startDateFormatted} đến ngày ${endDateFormatted} (${analysisDays} ngày).`,
      );
      lines.push('');
      lines.push(
        `Hãy phân tích chuyên sâu toàn bộ số liệu trên và đưa ra lời khuyên thực tế theo 4 nội dung sau:`,
      );
      lines.push(`1. 🩺 CHẨN ĐOÁN SỨC KHỎE DÒNG TIỀN (CASHFLOW HEALTH CHECK):`);
      lines.push(
        `   - Đánh giá dòng tiền ròng (Net Cashflow) và tốc độ tiêu hao sinh hoạt (Living Burn Rate: ${formatVND(dailyExpenseAvg)}/ngày).`,
      );
      lines.push(
        `   - Tỷ lệ tích lũy/tiết kiệm hiện tại (${savingsRate}%) có bền vững không?`,
      );
      lines.push(
        `2. 🔍 NHẬN DIỆN "LỖ RÒ RỈ DÒNG TIỀN" & CHI TIÊU BẤT THƯỜNG (MONEY LEAKS & ANOMALIES):`,
      );
      lines.push(
        `   - Danh mục nào đang chiếm tỷ trọng quá lớn hoặc vượt hạn mức ngân sách (${categoriesOverBudgetCount} danh mục vượt ngân sách)?`,
      );
      lines.push(
        `   - Dựa vào danh sách các giao dịch lớn và nội dung chuyển khoản chi tiết, chỉ ra các khoản chi không cần thiết, chi tiêu cảm xúc hoặc có thể cắt giảm.`,
      );
      lines.push(
        `3. ✂️ KẾ HOẠCH HÀNH ĐỘNG CẮT GIẢM & HẠN MỨC MỖI NGÀY (ACTIONABLE CUTBACK PLAN):`,
      );
      lines.push(
        `   - Đề xuất 3-5 hành động cụ thể để cắt giảm chi tiêu ngay trong tuần này và số tiền ước tính tiết kiệm được.`,
      );
      lines.push(
        `   - Đề xuất Hạn mức chi tiêu sinh hoạt tối đa mỗi ngày (Daily Spending Cap) an toàn.`,
      );
      lines.push(
        `4. 🎯 CHIẾN LƯỢC CHO CÁC KHOẢN ĐỊNH KỲ SẮP TỚI & DỰ PHÒNG TÀI CHÍNH:`,
      );
      lines.push(
        `   - Đưa ra lời khuyên để chuẩn bị cho các khoản cố định (tiền nhà, hóa đơn...) và nâng cao quỹ khẩn cấp.`,
      );
      lines.push('```');
      lines.push('');
    }

    // Section 1: Accounts
    lines.push(`---`);
    lines.push('');
    lines.push(`## 1. THÔNG TIN SỐ DƯ & CÁC TÀI KHOẢN`);
    lines.push(
      `- **Tổng số dư khả dụng hiện tại**: **${formatVND(totalCash)}**`,
    );
    lines.push(`- **Chi tiết các tài khoản**:`);
    lines.push('');
    lines.push(
      `| STT | Tên tài khoản | Ngân hàng / Đơn vị | Số tài khoản | Số dư hiện tại | Trạng thái |`,
    );
    lines.push(`|---|---|---|---|---|---|`);
    if (accounts.length === 0) {
      lines.push(
        `| 1 | Tài khoản chính | MB Bank | - | ${formatVND(totalCash)} | Đang hoạt động |`,
      );
    } else {
      accounts.forEach((acc, idx) => {
        lines.push(
          `| ${idx + 1} | ${acc.displayName} | ${acc.bankName || acc.provider || '-'} | ${acc.accountNumber || '-'} | ${formatVND(Number(acc.balance))} | ${acc.isActive ? 'Đang hoạt động' : 'Tạm dừng'} |`,
        );
      });
    }
    lines.push('');

    // Section 2: Cashflow Overview
    lines.push(`---`);
    lines.push('');
    lines.push(
      `## 2. TỔNG QUAN DÒNG TIỀN TRONG KỲ (${startDateFormatted} → ${endDateFormatted})`,
    );
    lines.push('');
    lines.push(
      `| Chỉ số tài chính | Giá trị trong kỳ | Bình quân mỗi ngày | Ghi chú & Phân loại |`,
    );
    lines.push(`|---|---|---|---|`);
    lines.push(
      `| **Tổng số giao dịch** | **${transactions.length} giao dịch** | ${(transactions.length / analysisDays).toFixed(1)} GD/ngày | Đã loại trừ chuyển khoản nội bộ |`,
    );
    lines.push(
      `| **Tổng chi tiêu thực tế** | **${formatVND(totalExpenseNum)}** | ${formatVND(totalExpenseNum / analysisDays)}/ngày | Tất cả các khoản tiền ra |`,
    );
    lines.push(
      `| ↳ *Chi tiêu sinh hoạt thuần (Living Expense)* | **${formatVND(livingExpenseNum)}** | **${formatVND(dailyExpenseAvg)}/ngày** | **Tốc độ đốt tiền sinh hoạt thực tế** |`,
    );
    lines.push(
      `| ↳ *Tiền cho vay / Công nợ tạm thời* | ${formatVND(debtLentNum)} | - | Đã bóc tách riêng, không tính là tiêu dùng |`,
    );
    lines.push(
      `| **Tổng thu nhập thực tế** | **${formatVND(totalIncomeNum)}** | ${formatVND(dailyIncomeAvg)}/ngày | Tất cả các khoản tiền vào |`,
    );
    lines.push(
      `| ↳ *Thu nhập sinh hoạt / Lương (Living Income)* | **${formatVND(livingIncomeNum)}** | - | Lương thưởng, thu nhập chủ động |`,
    );
    lines.push(
      `| ↳ *Thu hồi nợ / Hoàn tiền* | ${formatVND(debtRecoveredNum)} | - | Đã bóc tách riêng, không tính thu nhập đều |`,
    );
    lines.push(
      `| **Dòng tiền ròng sinh hoạt (Net Burn)** | **${netBurnNum >= 0 ? '-' : '+'}${formatVND(Math.abs(netBurnNum))}** | **${formatVND(dailyNetBurnAvg)}/ngày** | ${netBurnNum > 0 ? '⚠️ Đang thâm hụt sinh hoạt trong kỳ' : '✓ Đang thặng dư sinh hoạt trong kỳ'} |`,
    );
    lines.push(
      `| **Dòng tiền ròng tổng thể (Net Cashflow)** | **${netCashflowNum >= 0 ? '+' : ''}${formatVND(netCashflowNum)}** | - | Tổng tiền vào trừ tổng tiền ra |`,
    );
    lines.push(
      `| **Tỷ lệ tích lũy / tiết kiệm (Savings Rate)** | **${savingsRate}%** | - | Tỷ lệ tích lũy trên thu nhập sinh hoạt |`,
    );
    lines.push('');

    // Section 3: Categories & Budgets
    lines.push(`---`);
    lines.push('');
    lines.push(`## 3. PHÂN BỔ CHI TIÊU THEO HẠNG MỤC & ĐỐI CHIẾU NGÂN SÁCH`);
    lines.push('');
    lines.push(
      `| STT | Danh mục | Thực chi (VND) | Tỷ trọng (% chi) | Số GD | Bình quân/ngày | Hạn mức ngân sách | Đã dùng (%) | Còn lại (VND) | Đánh giá |`,
    );
    lines.push(`|---|---|---|---|---|---|---|---|---|---|`);
    if (categoryRows.length === 0) {
      lines.push(
        `| - | Không có chi tiêu trong kỳ | 0 VND | 0% | 0 | 0 VND | - | 0% | - | 🟢 An toàn |`,
      );
    } else {
      categoryRows.forEach((row, idx) => {
        const budgetCol =
          row.budgetAmount > 0 ? formatVND(row.budgetAmount) : 'Chưa đặt';
        const percentCol =
          row.budgetAmount > 0 ? `${row.percentOfBudget}%` : '-';
        const remainingCol =
          row.remainingBudget !== null ? formatVND(row.remainingBudget) : '-';
        lines.push(
          `| ${idx + 1} | ${row.name} | **${formatVND(row.spent)}** | ${row.percentOfTotal}% | ${row.txCount} | ${formatVND(row.dailyAvg)} | ${budgetCol} | ${percentCol} | ${remainingCol} | ${row.statusIcon} ${row.status} |`,
        );
      });
    }
    lines.push('');
    lines.push(`### 🎯 Tóm tắt kỷ luật ngân sách:`);
    lines.push(
      `- **Tổng hạn mức ngân sách định mức**: ${formatVND(totalBudgetSum)}`,
    );
    lines.push(
      `- **Tổng thực chi trong các danh mục có ngân sách**: ${formatVND(totalSpentInBudgetedSum)} (${budgetUtilizationPercent}%)`,
    );
    lines.push(
      `- **Danh mục vượt ngân sách (OVER BUDGET)**: ${categoriesOverBudgetCount} danh mục 🔴`,
    );
    lines.push(
      `- **Danh mục cận giới hạn (NEAR LIMIT >= 80%)**: ${categoriesNearLimitCount} danh mục 🟡`,
    );
    lines.push(
      `- **Danh mục trong hạn mức an toàn (SAFE)**: ${categoriesSafeCount} danh mục 🟢`,
    );
    lines.push('');

    // Section 4: Anomalies & Large Expenses
    lines.push(`---`);
    lines.push('');
    lines.push(`## 4. TOP CÁC GIAO DỊCH CHI TIÊU LỚN & ĐỘT BIẾN (ANOMALIES)`);
    lines.push(
      `> Các khoản chi từ 200.000 VND trở lên để AI phát hiện chi tiết bản chất giao dịch và thói quen tiêu dùng:`,
    );
    lines.push('');
    lines.push(
      `| STT | Ngày GD | Số tiền (VND) | Danh mục | Nội dung / Mô tả chuyển khoản | Tài khoản / Đối tác |`,
    );
    lines.push(`|---|---|---|---|---|---|`);
    if (anomalies.length === 0) {
      lines.push(
        `| - | - | - | - | Không có giao dịch lớn đột xuất trong kỳ này | - |`,
      );
    } else {
      anomalies.forEach((a, idx) => {
        lines.push(
          `| ${idx + 1} | ${a.date} | **${formatVND(a.amount)}** | ${a.categoryName} | ${a.description || '-'} | ${a.counterparty || a.accountName} |`,
        );
      });
    }
    lines.push('');

    // Section 5: Upcoming Obligations
    if (options.includeUpcoming !== false) {
      lines.push(`---`);
      lines.push('');
      lines.push(`## 5. CÁC KHOẢN CAM KẾT & CHI PHÍ ĐỊNH KỲ SẮP TỚI`);
      lines.push(
        `> Khoản cố định (tiền nhà, internet, sinh hoạt...) cần bảo toàn dòng tiền:`,
      );
      lines.push('');
      lines.push(
        `| STT | Khoản cam kết / Định kỳ | Số tiền (VND) | Loại | Ngày đến hạn trong tháng | Bắt buộc |`,
      );
      lines.push(`|---|---|---|---|---|---|`);
      if (recurring.length === 0) {
        lines.push(
          `| 1 | 🏠 Tiền thuê nhà định kỳ | 7.000.000 VND | Chi tiêu | Ngày 5 hàng tháng | Có |`,
        );
      } else {
        recurring.forEach((r, idx) => {
          lines.push(
            `| ${idx + 1} | ${r.name} | **${formatVND(Number(r.amount))}** | ${r.direction === TransactionDirection.EXPENSE ? 'Chi tiêu' : 'Thu nhập'} | Ngày ${r.dayOfMonth} hàng tháng | ${r.isObligation ? 'Có' : 'Tùy chọn'} |`,
          );
        });
      }
      lines.push('');
    }

    // Section 6: Savings Goals
    if (options.includeSavings !== false && savings.length > 0) {
      lines.push(`---`);
      lines.push('');
      lines.push(`## 6. TIẾN ĐỘ CÁC MỤC TIÊU TIẾT KIỆM (SAVINGS GOALS)`);
      lines.push('');
      lines.push(
        `| STT | Mục tiêu tiết kiệm | Đã tích lũy (VND) | Mục tiêu (VND) | Tiến độ (%) | Hạn hoàn thành |`,
      );
      lines.push(`|---|---|---|---|---|---|`);
      savings.forEach((s, idx) => {
        const cur = Number(s.currentAmount);
        const tgt = Number(s.targetAmount);
        const pct = tgt > 0 ? Math.round((cur / tgt) * 100) : 0;
        lines.push(
          `| ${idx + 1} | ${s.name} | ${formatVND(cur)} | ${formatVND(tgt)} | **${pct}%** | ${toVnDate(s.targetDate)} |`,
        );
      });
      lines.push('');
    }

    // Section 7: Complete Transaction Ledger
    if (options.includeTransactions !== false) {
      lines.push(`---`);
      lines.push('');
      lines.push(
        `## 7. TOÀN BỘ SỔ NHẬT KÝ GIAO DỊCH TRONG KỲ (${transactions.length} GIAO DỊCH)`,
      );
      lines.push(
        `> Danh sách chi tiết từng giao dịch theo trình tự thời gian gần nhất:`,
      );
      lines.push('');
      lines.push(
        `| STT | Ngày GD | Chi / Thu | Danh mục | Số tiền (VND) | Nội dung chuyển khoản / Mô tả | Tài khoản |`,
      );
      lines.push(`|---|---|---|---|---|---|---|`);
      if (transactions.length === 0) {
        lines.push(
          `| - | - | - | - | Không có giao dịch phát sinh trong kỳ | - | - |`,
        );
      } else {
        transactions.forEach((tx, idx) => {
          const isIncome = tx.direction === TransactionDirection.INCOME;
          const sign = isIncome ? '+' : '-';
          const typeBadge = isIncome ? 'Thu' : 'Chi';
          const catName = tx.category?.name || 'Chưa phân loại';
          const accName = tx.account?.displayName || 'Tài khoản';
          const cleanDesc = (tx.description || '')
            .replace(/\|/g, '/')
            .replace(/\n/g, ' ');
          lines.push(
            `| ${idx + 1} | ${toVnDate(tx.transactionDate)} | ${typeBadge} | ${catName} | **${sign}${formatVND(Number(tx.amount))}** | ${cleanDesc} | ${accName} |`,
          );
        });
      }
      lines.push('');
    }

    lines.push(`---`);
    lines.push(
      `*Báo cáo được xuất tự động từ hệ thống Quản lý Tài chính Cashflow vào lúc ${nowFormatted}.*`,
    );

    const markdown = lines.join('\n');
    const filename = `Bao_cao_tai_chinh_Cashflow_${toIsoDate(startD)}_den_${toIsoDate(endD)}.md`;

    return {
      markdown,
      filename,
      timeframe: {
        startDate: toIsoDate(startD),
        startDateFormatted,
        endDate: toIsoDate(endD),
        endDateFormatted,
        analysisDays,
      },
      summary: {
        totalCash,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        livingIncome: livingIncomeNum,
        livingExpense: livingExpenseNum,
        debtLentTotal: debtLentNum,
        debtRecoveredTotal: debtRecoveredNum,
        netBurn: netBurnNum,
        netCashflow: netCashflowNum,
        dailyExpenseAvg,
        dailyIncomeAvg,
        dailyNetBurnAvg,
        savingsRate,
        txCount: transactions.length,
        anomaliesCount: anomalies.length,
        categoriesOverBudget: categoriesOverBudgetCount,
      },
    };
  }
}
