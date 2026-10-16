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
   * Pre-loads default parameters, detected salary, and suggested upcoming milestone items
   * without triggering an AI API call.
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

    // Detected salary
    const latestSalary = await this.prisma.transaction.findFirst({
      where: {
        userId,
        direction: TransactionDirection.INCOME,
        amount: { gte: 10000000 },
      },
      orderBy: { transactionDate: 'desc' },
    });
    const detectedSalaryAmount = latestSalary ? Number(latestSalary.amount) : 20862750;

    // Default dates:
    // Analysis range: from 10th of this month to today (or 7 days ago if today <= 10)
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

    // Rent dates: next month 5th and 7th
    const rentMonth = now.getDate() >= 10 ? currentMonth + 1 : currentMonth;
    const rentDate5 = `${currentYear}-${pad(rentMonth + 1)}-05`;
    const rentDate7 = `${currentYear}-${pad(rentMonth + 1)}-07`;

    // 20/10 milestone (Vietnamese Women's Day):
    const gift2010Date = `${currentYear}-10-20`;

    // Utility bills:
    const billDate = `${currentYear}-${pad(rentMonth + 1)}-02`;

    const suggestedUpcomingItems: UpcomingItem[] = [
      {
        id: 'rent_05',
        name: '🏠 Tiền nhà / Tiền phòng (Mùng 5 tháng sau)',
        amount: 4500000,
        type: 'EXPENSE',
        dueDate: rentDate5,
        enabled: true,
        category: 'Thuê nhà',
        isQuickPreset: true,
      },
      {
        id: 'rent_07',
        name: '🏠 Tiền nhà / Tiền phòng (Mùng 7 tháng sau)',
        amount: 4500000,
        type: 'EXPENSE',
        dueDate: rentDate7,
        enabled: false,
        category: 'Thuê nhà',
        isQuickPreset: true,
      },
      {
        id: 'gift_20_10',
        name: '🎁 Tiền quà 20/10 Phụ Nữ Việt Nam',
        amount: 1000000,
        type: 'EXPENSE',
        dueDate: gift2010Date,
        enabled: true,
        category: 'Quà tặng',
        isQuickPreset: true,
      },
      {
        id: 'utility_bills',
        name: '⚡ Hóa đơn Điện / Nước / Internet',
        amount: 1200000,
        type: 'EXPENSE',
        dueDate: billDate,
        enabled: true,
        category: 'Hóa đơn & Tiện ích',
        isQuickPreset: true,
      },
      {
        id: 'party_event',
        name: '🧧 Tiệc cưới / Sinh nhật bạn bè',
        amount: 800000,
        type: 'EXPENSE',
        dueDate: `${currentYear}-10-28`,
        enabled: false,
        category: 'Xã giao & Giải trí',
        isQuickPreset: true,
      },
    ];

    // Check user recurring obligations from DB
    const dbRecurring = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
    });
    for (const r of dbRecurring) {
      const day = r.dayOfMonth || 5;
      const dueDate = `${currentYear}-${pad(rentMonth + 1)}-${pad(day)}`;
      suggestedUpcomingItems.push({
        id: `db_${r.id}`,
        name: r.name,
        amount: Number(r.amount),
        type: r.direction === TransactionDirection.INCOME ? 'INCOME' : 'EXPENSE',
        dueDate,
        enabled: r.isActive,
        isQuickPreset: false,
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
    };
  }

  /**
   * Run comprehensive analysis & projections with Gemini AI
   */
  async analyze(userId: string, options: AnalyzeOptions = {}): Promise<ForecastResponse> {
    const now = new Date();

    // 1. Resolve Dates from user input or sensible defaults
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

    // 4. Compute Totals & Categorical Breakdown
    let totalIncome = new Decimal(0);
    let totalExpense = new Decimal(0);
    const categoryMap = new Map<string, { id: string; name: string; color: string; amount: Decimal; count: number }>();
    const anomalies: any[] = [];

    for (const tx of transactions) {
      const amt = new Decimal(tx.amount.toString());
      if (tx.direction === TransactionDirection.INCOME) {
        totalIncome = totalIncome.plus(amt);
      } else if (tx.direction === TransactionDirection.EXPENSE) {
        totalExpense = totalExpense.plus(amt);

        const catId = tx.categoryId || 'uncategorized';
        const catName = tx.category?.name || 'Chưa phân loại';
        const catColor = tx.category?.color || '#64748b';

        if (!categoryMap.has(catId)) {
          categoryMap.set(catId, {
            id: catId,
            name: catName,
            color: catColor,
            amount: new Decimal(0),
            count: 0,
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
          });
        }
      }
    }

    const totalExpenseNum = totalExpense.toNumber();
    const totalIncomeNum = totalIncome.toNumber();
    const netBurnNum = totalExpense.minus(totalIncome).toNumber();

    const dailyExpenseAvg = Math.round(totalExpenseNum / analysisDays);
    const dailyIncomeAvg = Math.round(totalIncomeNum / analysisDays);
    const dailyNetBurnAvg = Math.max(0, Math.round(netBurnNum / analysisDays));

    const categoriesList = Array.from(categoryMap.values())
      .map((c) => ({
        id: c.id,
        name: c.name,
        color: c.color,
        amount: c.amount.toNumber(),
        percent: totalExpenseNum > 0 ? Math.round((c.amount.toNumber() / totalExpenseNum) * 100) : 0,
        count: c.count,
      }))
      .sort((a, b) => b.amount - a.amount);

    // 5. Query Historical Salary Patterns
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
    const detectedSalaryAmount = latestSalary ? new Decimal(latestSalary.amount.toString()).toNumber() : 20862750;
    const historicalSalaryDesc = latestSalary ? latestSalary.description : 'CT TNHH Phat trien nguon nhan luc Gina Viet Nam';

    // If user explicitly provided expectedIncome, use it; otherwise use detected salary
    const expectedIncome = options.expectedIncome !== undefined ? Number(options.expectedIncome) : detectedSalaryAmount;

    // 6. Handle Upcoming Planned Items (Khoản dự kiến sắp tới - Tiền nhà, quà 20/10, v.v.)
    const rawUpcoming = options.upcomingItems || [];
    const enabledUpcoming = rawUpcoming.filter((item) => item.enabled === true);

    let totalUpcomingExpenses = 0;
    let totalUpcomingIncomes = 0;
    const expensesList: UpcomingItem[] = [];
    const incomesList: UpcomingItem[] = [];

    for (const item of enabledUpcoming) {
      const itemDue = new Date(item.dueDate);
      itemDue.setHours(23, 59, 59, 999);

      // Only count items that occur within the forecast window (before or on targetDate)
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

    // Calculate safe daily allowance after reserving funds for upcoming expenses
    const reserveNeeded = Math.max(0, totalUpcomingExpenses - totalUpcomingIncomes);
    const availableForLiving = Math.max(0, currentBalance - reserveNeeded);
    const safeDailySpendingAllowance = Math.max(0, Math.round(availableForLiving / forecastDays));

    // 7. Calculate Projections (incorporating upcoming items)
    // Baseline (maintains current daily burn rate + upcoming planned expenses)
    const baselineDailyBurn = dailyNetBurnAvg > 0 ? dailyNetBurnAvg : dailyExpenseAvg;
    const baselineRegularExpense = baselineDailyBurn * forecastDays;
    const baselineProjectedExpense = baselineRegularExpense + totalUpcomingExpenses;
    const baselineBalanceBefore = currentBalance - baselineRegularExpense - totalUpcomingExpenses + totalUpcomingIncomes;
    const baselineBalanceAfter = baselineBalanceBefore + expectedIncome;

    // Optimized (strips out anomalies/loans, tight living expenses + upcoming planned expenses)
    let anomalyTotal = new Decimal(0);
    for (const a of anomalies) {
      if (a.categoryName === 'Cho vay' || a.amount >= 500000) {
        anomalyTotal = anomalyTotal.plus(a.amount);
      }
    }
    const regularExpense = Decimal.max(0, totalExpense.minus(anomalyTotal)).toNumber();
    const optimizedDailyBurn = Math.max(
      100000,
      Math.round(Math.max(0, regularExpense - totalIncomeNum) / analysisDays),
    );
    const optimizedRegularExpense = optimizedDailyBurn * forecastDays;
    const optimizedProjectedExpense = optimizedRegularExpense + totalUpcomingExpenses;
    const optimizedBalanceBefore = currentBalance - optimizedRegularExpense - totalUpcomingExpenses + totalUpcomingIncomes;
    const optimizedBalanceAfter = optimizedBalanceBefore + expectedIncome;

    // Conservative (higher burn + upcoming planned expenses)
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

    // 8. Call Gemini AI with complete user parameters
    const aiAnalysis = await this.geminiService.analyzeFinancialData(context);

    return {
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
  }
}
