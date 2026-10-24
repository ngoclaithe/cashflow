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
  return n === 'thu hồi nợ' || n.includes('thu hồi nợ') || n.includes('thu nợ') || n.includes('đòi nợ');
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
    const toIsoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    // Primary account
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
    });
    const primaryAccount =
      accounts.find((a) => a.accountNumber?.includes('1468651509999')) ||
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

    const recurringSalary = dbRecurring.find((r) => r.direction === TransactionDirection.INCOME);
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
        const isRent = r.name.toLowerCase().includes('nhà') || r.name.toLowerCase().includes('phòng');
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
  async analyze(userId: string, options: AnalyzeOptions = {}): Promise<ForecastResponse> {
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

    if (isNaN(startD.getTime()) || isNaN(endD.getTime()) || isNaN(targetD.getTime())) {
      throw new BadRequestException('Ngày tháng cung cấp không hợp lệ');
    }

    if (startD > endD) {
      throw new BadRequestException('Ngày bắt đầu không thể sau ngày kết thúc');
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const analysisDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / msPerDay));
    const forecastDays = Math.max(1, Math.round((targetD.getTime() - endD.getTime()) / msPerDay));

    // 2. Query Accounts
    const accounts = await this.prisma.account.findMany({
      where: {
        userId,
        isActive: true,
        ...(options.accountId ? { id: options.accountId } : {}),
      },
    });

    const primaryAccount =
      accounts.find((a) => a.accountNumber?.includes('1468651509999')) ||
      accounts[0] || {
        id: 'default',
        displayName: 'MB Bank',
        accountNumber: '1468651509999',
        balance: 0,
      };

    let totalCashDecimal = new Decimal(0);
    for (const acc of accounts) {
      totalCashDecimal = totalCashDecimal.plus(new Decimal(acc.balance.toString()));
    }
    const currentBalance = new Decimal(primaryAccount.balance.toString()).toNumber();
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

    const categoryMap = new Map<string, { id: string; name: string; color: string; amount: Decimal; count: number; isDebt: boolean }>();
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
        percent: livingExpenseNum > 0 ? Math.round((c.amount.toNumber() / (c.isDebt ? totalExpenseNum : livingExpenseNum)) * 100) : 0,
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
        budgetMapByCategoryId.set(b.categoryId, (budgetMapByCategoryId.get(b.categoryId) || 0) + amt);
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
      let status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' = 'NO_BUDGET';
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
        (c) => c.id === bCatId || c.name.toLowerCase() === bCatName.toLowerCase(),
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
        totalBudgetSum > 0 ? Math.round((totalSpentInBudgetedSum / totalBudgetSum) * 100) : 0,
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
    const detectedSalaryAmount = latestSalary ? new Decimal(latestSalary.amount.toString()).toNumber() : 20300000;
    const historicalSalaryDesc = latestSalary ? latestSalary.description : 'CT TNHH Phat trien nguon nhan luc Gina Viet Nam';

    const expectedIncome = options.expectedIncome !== undefined ? Number(options.expectedIncome) : detectedSalaryAmount;

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

    const reserveNeeded = Math.max(0, totalUpcomingExpenses - totalUpcomingIncomes);
    const availableForLiving = Math.max(0, currentBalance - reserveNeeded);
    const safeDailySpendingAllowance = Math.max(0, Math.round(availableForLiving / forecastDays));

    // 8. Calculate Projections
    const baselineDailyBurn = dailyNetBurnAvg > 0 ? dailyNetBurnAvg : dailyExpenseAvg;
    const baselineRegularExpense = baselineDailyBurn * forecastDays;
    const baselineProjectedExpense = baselineRegularExpense + totalUpcomingExpenses;
    const baselineBalanceBefore = currentBalance - baselineRegularExpense - totalUpcomingExpenses + totalUpcomingIncomes;
    const baselineBalanceAfter = baselineBalanceBefore + expectedIncome;

    let anomalyTotal = new Decimal(0);
    for (const a of anomalies) {
      if (!a.isDebt && a.amount >= 500000) {
        anomalyTotal = anomalyTotal.plus(a.amount);
      }
    }
    const regularExpense = Decimal.max(0, livingExpense.minus(anomalyTotal)).toNumber();
    const optimizedDailyBurn = Math.max(
      100000,
      Math.round(Math.max(0, regularExpense - livingIncomeNum) / analysisDays),
    );
    const optimizedRegularExpense = optimizedDailyBurn * forecastDays;
    const optimizedProjectedExpense = optimizedRegularExpense + totalUpcomingExpenses;
    const optimizedBalanceBefore = currentBalance - optimizedRegularExpense - totalUpcomingExpenses + totalUpcomingIncomes;
    const optimizedBalanceAfter = optimizedBalanceBefore + expectedIncome;

    const conservativeDailyBurn = Math.max(500000, Math.round(baselineDailyBurn * 1.35));
    const conservativeRegularExpense = conservativeDailyBurn * forecastDays;
    const conservativeProjectedExpense = conservativeRegularExpense + totalUpcomingExpenses;
    const conservativeBalanceBefore = Math.max(0, currentBalance - conservativeRegularExpense - totalUpcomingExpenses + totalUpcomingIncomes);
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
        lastReceivedDate: latestSalary ? latestSalary.transactionDate.toISOString().slice(0, 10) : '',
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
      this.logger.log(`Saved latest AI forecast result to DB for user ${userId}`);
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
      this.logger.error('Failed to read latest AI forecast result from DB', err);
      return null;
    }
  }

  /**
   * Fast, real-time Category Budget Report for a selected historical period.
   * Does NOT call Gemini AI, calculates instantaneously from DB transactions & budgets.
   */
  async getCategoryReport(userId: string, startDate?: string, endDate?: string) {
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
    const analysisDays = Math.max(1, Math.round((endD.getTime() - startD.getTime()) / msPerDay));

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

    const categoryMap = new Map<string, { id: string; name: string; color: string; amount: Decimal; count: number; isDebt: boolean }>();
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
        percent: livingExpenseNum > 0 ? Math.round((c.amount.toNumber() / (c.isDebt ? totalExpenseNum : livingExpenseNum)) * 100) : 0,
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
        budgetMapByCategoryId.set(b.categoryId, (budgetMapByCategoryId.get(b.categoryId) || 0) + amt);
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
      let status: 'SAFE' | 'NEAR_LIMIT' | 'OVER_BUDGET' | 'NO_BUDGET' = 'NO_BUDGET';
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
        (c) => c.id === bCatId || c.name.toLowerCase() === bCatName.toLowerCase(),
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
          totalBudgetSum > 0 ? Math.round((totalSpentInBudgetedSum / totalBudgetSum) * 100) : 0,
        categoriesOverBudget: categoriesOverBudgetCount,
        categoriesNearLimit: categoriesNearLimitCount,
        categoriesSafe: categoriesSafeCount,
      },
      anomalies,
    };
  }
}

