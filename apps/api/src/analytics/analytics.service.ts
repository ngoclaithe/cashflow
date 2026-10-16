import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GeminiService, GeminiAnalysisResult } from './gemini.service';
import { TransactionDirection } from '@prisma/client';
import Decimal from 'decimal.js';

export interface ForecastResponse {
  account: {
    id: string;
    displayName: string;
    accountNumber: string;
    balance: number;
    totalCash: number;
  };
  cycle: {
    startDate: string;
    startDateFormatted: string;
    targetDate: string;
    targetDateFormatted: string;
    today: string;
    todayFormatted: string;
    totalDays: number;
    daysElapsed: number;
    daysRemaining: number;
    progressPercent: number;
  };
  stats: {
    txCount: number;
    totalIncome: number;
    totalExpense: number;
    netBurn: number;
    dailyExpenseAvg: number;
    dailyNetBurnAvg: number;
    safeDailySpendingAllowance: number;
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
      projectedExpense: number;
      projectedBalanceBeforeSalary: number;
      projectedBalanceAfterSalary: number;
      status: 'SAFE' | 'WARNING' | 'DANGER';
    };
    optimized: {
      label: string;
      description: string;
      dailyBurn: number;
      projectedExpense: number;
      projectedBalanceBeforeSalary: number;
      projectedBalanceAfterSalary: number;
      status: 'EXCELLENT';
    };
    conservative: {
      label: string;
      description: string;
      dailyBurn: number;
      projectedExpense: number;
      projectedBalanceBeforeSalary: number;
      projectedBalanceAfterSalary: number;
      status: 'CAUTION';
    };
  };
  aiAnalysis: GeminiAnalysisResult;
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private cache = new Map<string, { data: ForecastResponse; timestamp: number }>();
  private readonly CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly geminiService: GeminiService,
  ) {}

  async getCashflowForecast(userId: string, forceRefresh = false): Promise<ForecastResponse> {
    const cached = this.cache.get(userId);
    if (!forceRefresh && cached && Date.now() - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    // 1. Get Accounts & Current Balance
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

    let totalCashDecimal = new Decimal(0);
    for (const acc of accounts) {
      totalCashDecimal = totalCashDecimal.plus(new Decimal(acc.balance.toString()));
    }
    const currentBalance = new Decimal(primaryAccount.balance.toString()).toNumber();
    const totalCash = totalCashDecimal.toNumber();

    // 2. Determine Salary Cycle (10th of this month to 10th of next month)
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth(); // 0-indexed
    const currentDay = now.getDate();

    let startDate: Date;
    let targetDate: Date;

    if (currentDay >= 10) {
      startDate = new Date(currentYear, currentMonth, 10, 0, 0, 0, 0);
      targetDate = new Date(currentYear, currentMonth + 1, 10, 23, 59, 59, 999);
    } else {
      startDate = new Date(currentYear, currentMonth - 1, 10, 0, 0, 0, 0);
      targetDate = new Date(currentYear, currentMonth, 10, 23, 59, 59, 999);
    }

    const msPerDay = 1000 * 60 * 60 * 24;
    const totalDays = Math.max(1, Math.round((targetDate.getTime() - startDate.getTime()) / msPerDay));
    const daysElapsed = Math.max(1, Math.round((now.getTime() - startDate.getTime()) / msPerDay));
    const daysRemaining = Math.max(1, Math.round((targetDate.getTime() - now.getTime()) / msPerDay));
    const progressPercent = Math.min(100, Math.round((daysElapsed / totalDays) * 100));

    // 3. Query all transactions in the current cycle
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        isInternalTransfer: false,
        transactionDate: {
          gte: startDate,
          lte: now,
        },
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

        // Anomaly: >= 500,000 VND
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

    const dailyExpenseAvg = Math.round(totalExpenseNum / daysElapsed);
    const dailyNetBurnAvg = Math.max(0, Math.round(netBurnNum / daysElapsed));
    const safeDailySpendingAllowance = Math.max(0, Math.round(currentBalance / daysRemaining));

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
    const historicalSalaryAmount = latestSalary ? new Decimal(latestSalary.amount.toString()).toNumber() : 20862750;
    const historicalSalaryDesc = latestSalary ? latestSalary.description : 'CT TNHH Phat trien nguon nhan luc Gina Viet Nam tt Luong';

    // 6. Calculate Mathematical Projections
    // Scenario 1: Baseline (Duy trì tốc độ net burn thực tế 7 ngày qua)
    const baselineBurn = dailyNetBurnAvg > 0 ? dailyNetBurnAvg : dailyExpenseAvg;
    const baselineExpenseNext = baselineBurn * daysRemaining;
    const baselineBalanceBefore = currentBalance - baselineExpenseNext;
    const baselineBalanceAfter = baselineBalanceBefore + historicalSalaryAmount;

    // Scenario 2: Optimized (Tiết kiệm, loại trừ khoản cho vay/đột xuất)
    let anomalyTotal = new Decimal(0);
    for (const a of anomalies) {
      if (a.categoryName === 'Cho vay' || a.amount >= 500000) {
        anomalyTotal = anomalyTotal.plus(a.amount);
      }
    }
    const regularExpense = Decimal.max(0, totalExpense.minus(anomalyTotal)).toNumber();
    const optimizedDailyBurn = Math.max(
      150000,
      Math.round(Math.max(0, regularExpense - totalIncomeNum) / daysElapsed),
    );
    const optimizedExpenseNext = optimizedDailyBurn * daysRemaining;
    const optimizedBalanceBefore = currentBalance - optimizedExpenseNext;
    const optimizedBalanceAfter = optimizedBalanceBefore + historicalSalaryAmount;

    // Scenario 3: Conservative (Dự phòng chi tiêu cao cuối tháng)
    const conservativeDailyBurn = Math.max(500000, Math.round(baselineBurn * 1.4));
    const conservativeExpenseNext = conservativeDailyBurn * daysRemaining;
    const conservativeBalanceBefore = Math.max(0, currentBalance - conservativeExpenseNext);
    const conservativeBalanceAfter = conservativeBalanceBefore + historicalSalaryAmount;

    // Context object to pass to Gemini
    const context = {
      account: {
        displayName: primaryAccount.displayName,
        accountNumber: primaryAccount.accountNumber,
        balance: currentBalance,
      },
      cycle: {
        startDateFormatted: startDate.toLocaleDateString('vi-VN'),
        targetDateFormatted: targetDate.toLocaleDateString('vi-VN'),
        totalDays,
        daysElapsed,
        daysRemaining,
        progressPercent,
      },
      stats: {
        txCount: transactions.length,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        netBurn: netBurnNum,
        dailyExpenseAvg,
        dailyNetBurnAvg,
        safeDailySpendingAllowance,
      },
      categories: categoriesList,
      anomalies,
      historicalSalary: {
        amount: historicalSalaryAmount,
        description: historicalSalaryDesc,
        companyName: 'Gina Việt Nam',
        lastReceivedDate: latestSalary ? latestSalary.transactionDate.toISOString().slice(0, 10) : '2026-10-09',
      },
      projections: {
        baseline: {
          projectedExpense: baselineExpenseNext,
          projectedBalanceBeforeSalary: baselineBalanceBefore,
          projectedBalanceAfterSalary: baselineBalanceAfter,
          projectedBalanceBeforeSalaryFormatted: `${baselineBalanceBefore.toLocaleString('vi-VN')} đ`,
        },
        optimized: {
          projectedExpense: optimizedExpenseNext,
          projectedBalanceBeforeSalary: optimizedBalanceBefore,
          projectedBalanceAfterSalary: optimizedBalanceAfter,
        },
        conservative: {
          projectedExpense: conservativeExpenseNext,
          projectedBalanceBeforeSalary: conservativeBalanceBefore,
          projectedBalanceAfterSalary: conservativeBalanceAfter,
        },
      },
    };

    // 7. Call Gemini AI
    const aiAnalysis = await this.geminiService.analyzeFinancialData(context);

    const result: ForecastResponse = {
      account: {
        id: primaryAccount.id,
        displayName: primaryAccount.displayName,
        accountNumber: primaryAccount.accountNumber || '',
        balance: currentBalance,
        totalCash,
      },
      cycle: {
        startDate: startDate.toISOString(),
        startDateFormatted: startDate.toLocaleDateString('vi-VN'),
        targetDate: targetDate.toISOString(),
        targetDateFormatted: targetDate.toLocaleDateString('vi-VN'),
        today: now.toISOString(),
        todayFormatted: now.toLocaleDateString('vi-VN'),
        totalDays,
        daysElapsed,
        daysRemaining,
        progressPercent,
      },
      stats: {
        txCount: transactions.length,
        totalIncome: totalIncomeNum,
        totalExpense: totalExpenseNum,
        netBurn: netBurnNum,
        dailyExpenseAvg,
        dailyNetBurnAvg,
        safeDailySpendingAllowance,
      },
      categories: categoriesList,
      anomalies,
      historicalSalary: {
        amount: historicalSalaryAmount,
        description: historicalSalaryDesc,
        companyName: 'Gina Việt Nam',
        lastReceivedDate: latestSalary ? latestSalary.transactionDate.toISOString().slice(0, 10) : '2026-10-09',
      },
      projections: {
        baseline: {
          label: 'Kịch bản cơ sở (Duy trì tốc độ 7 ngày qua)',
          description: `Bình quân tiêu hao ròng ${baselineBurn.toLocaleString('vi-VN')} đ/ngày`,
          dailyBurn: baselineBurn,
          projectedExpense: baselineExpenseNext,
          projectedBalanceBeforeSalary: baselineBalanceBefore,
          projectedBalanceAfterSalary: baselineBalanceAfter,
          status: baselineBalanceBefore > 5000000 ? 'SAFE' : 'WARNING',
        },
        optimized: {
          label: 'Kịch bản tối ưu (Tiết kiệm, không phát sinh đột xuất)',
          description: `Kiềm chế chi tiêu ở mức ${optimizedDailyBurn.toLocaleString('vi-VN')} đ/ngày`,
          dailyBurn: optimizedDailyBurn,
          projectedExpense: optimizedExpenseNext,
          projectedBalanceBeforeSalary: optimizedBalanceBefore,
          projectedBalanceAfterSalary: optimizedBalanceAfter,
          status: 'EXCELLENT',
        },
        conservative: {
          label: 'Kịch bản thận trọng (Chi tiêu tăng cao cuối tháng)',
          description: `Dự phòng phát sinh tiệc tùng/mua sắm ~${conservativeDailyBurn.toLocaleString('vi-VN')} đ/ngày`,
          dailyBurn: conservativeDailyBurn,
          projectedExpense: conservativeExpenseNext,
          projectedBalanceBeforeSalary: conservativeBalanceBefore,
          projectedBalanceAfterSalary: conservativeBalanceAfter,
          status: 'CAUTION',
        },
      },
      aiAnalysis,
    };

    // Cache the result
    this.cache.set(userId, { data: result, timestamp: Date.now() });

    return result;
  }
}
