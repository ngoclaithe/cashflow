import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { BudgetsService } from '../budgets/budgets.service';
import { RecurringTransactionsService } from '../recurring-transactions/recurring-transactions.service';
import { SavingsGoalsService } from '../savings-goals/savings-goals.service';
import { TransactionDirection } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class DashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly budgetsService: BudgetsService,
    private readonly recurringService: RecurringTransactionsService,
    private readonly savingsService: SavingsGoalsService,
  ) {}

  async getSummary(userId: string) {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    // 1. Current Available Cash / Bank Balance
    const accounts = await this.prisma.account.findMany({
      where: { userId, isActive: true },
      select: { balance: true, displayName: true, bankName: true, provider: true },
    });

    let totalCashDecimal = new Decimal(0);
    for (const acc of accounts) {
      totalCashDecimal = totalCashDecimal.plus(new Decimal(acc.balance.toString()));
    }
    const availableCash = totalCashDecimal.toNumber();

    // 2. Current Month Income and Expenses (excluding internal transfers)
    const monthTransactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        isInternalTransfer: false,
        transactionDate: {
          gte: startOfMonth,
          lte: endOfMonth,
        },
      },
      select: {
        amount: true,
        direction: true,
        categoryId: true,
      },
    });

    let incomeDecimal = new Decimal(0);
    let expenseDecimal = new Decimal(0);

    for (const tx of monthTransactions) {
      const amt = new Decimal(tx.amount.toString());
      if (tx.direction === TransactionDirection.INCOME) {
        incomeDecimal = incomeDecimal.plus(amt);
      } else if (tx.direction === TransactionDirection.EXPENSE) {
        expenseDecimal = expenseDecimal.plus(amt);
      }
    }

    const totalIncome = incomeDecimal.toNumber();
    const totalExpense = expenseDecimal.toNumber();
    const netCashFlow = incomeDecimal.minus(expenseDecimal).toNumber();

    // 3. Category Breakdown for current month
    const categoryBreakdown = await this.getCategoryBreakdown(userId, startOfMonth, endOfMonth);

    // 4. Budgets Status
    const budgets = await this.budgetsService.findAll(userId);
    let totalBudgetLimit = 0;
    let totalBudgetSpent = 0;
    for (const b of budgets) {
      totalBudgetLimit += b.limitAmount;
      totalBudgetSpent += b.spentAmount;
    }

    // 5. Upcoming Obligations (e.g. Rent before day 5)
    const upcomingObligations = await this.recurringService.getUpcomingObligations(
      userId,
      availableCash,
    );

    // 6. Savings Goals
    const savingsGoals = await this.savingsService.findAll(userId);

    // 7. Recent Transactions
    const recentTransactions = await this.prisma.transaction.findMany({
      where: { userId },
      take: 8,
      orderBy: { transactionDate: 'desc' },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
        account: {
          select: { displayName: true, bankName: true },
        },
      },
    });

    // 8. Uncategorized Count
    const uncategorizedCount = await this.prisma.transaction.count({
      where: { userId, categoryId: null },
    });

    // 9. Last Sync Status
    const lastSync = await this.prisma.syncRun.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    return {
      availableCash,
      currentMonth: {
        month: now.getMonth() + 1,
        year: now.getFullYear(),
        income: totalIncome,
        expenses: totalExpense,
        netCashFlow,
      },
      accounts: accounts.map((a) => ({
        name: a.displayName,
        bank: a.bankName,
        provider: a.provider,
        balance: new Decimal(a.balance.toString()).toNumber(),
      })),
      categoryBreakdown,
      budgetsSummary: {
        totalLimit: totalBudgetLimit,
        totalSpent: totalBudgetSpent,
        totalRemaining: Math.max(0, totalBudgetLimit - totalBudgetSpent),
        items: budgets,
      },
      upcomingObligations,
      savingsGoals,
      recentTransactions,
      uncategorizedCount,
      lastSync,
    };
  }

  async getCashFlowHistory(userId: string, months = 6) {
    const history: Array<{
      monthLabel: string;
      income: number;
      expense: number;
      net: number;
    }> = [];

    const now = new Date();

    for (let i = months - 1; i >= 0; i--) {
      const year = now.getFullYear();
      const month = now.getMonth() - i;
      const d = new Date(year, month, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);

      const txs = await this.prisma.transaction.findMany({
        where: {
          userId,
          isInternalTransfer: false,
          transactionDate: { gte: start, lte: end },
        },
        select: { amount: true, direction: true },
      });

      let inc = new Decimal(0);
      let exp = new Decimal(0);

      for (const t of txs) {
        const amt = new Decimal(t.amount.toString());
        if (t.direction === TransactionDirection.INCOME) inc = inc.plus(amt);
        else if (t.direction === TransactionDirection.EXPENSE) exp = exp.plus(amt);
      }

      history.push({
        monthLabel: `T${start.getMonth() + 1}/${start.getFullYear()}`,
        income: inc.toNumber(),
        expense: exp.toNumber(),
        net: inc.minus(exp).toNumber(),
      });
    }

    return history;
  }

  async getCategoryBreakdown(userId: string, startDate?: Date, endDate?: Date) {
    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1);
    const end = endDate || new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const expenseTxs = await this.prisma.transaction.findMany({
      where: {
        userId,
        direction: TransactionDirection.EXPENSE,
        isInternalTransfer: false,
        transactionDate: { gte: start, lte: end },
      },
      include: {
        category: true,
      },
    });

    const categoryTotals = new Map<
      string,
      { id: string; name: string; color: string; icon?: string; total: Decimal }
    >();

    let totalExpenseAll = new Decimal(0);

    for (const tx of expenseTxs) {
      const amt = new Decimal(tx.amount.toString());
      totalExpenseAll = totalExpenseAll.plus(amt);

      const catId = tx.category?.id || 'UNCATEGORIZED';
      const catName = tx.category?.name || 'Chưa phân loại';
      const catColor = tx.category?.color || '#94a3b8';
      const catIcon = tx.category?.icon || 'HelpCircle';

      const existing = categoryTotals.get(catId);
      if (existing) {
        existing.total = existing.total.plus(amt);
      } else {
        categoryTotals.set(catId, {
          id: catId,
          name: catName,
          color: catColor,
          icon: catIcon,
          total: amt,
        });
      }
    }

    const items = Array.from(categoryTotals.values()).map((c) => {
      const percentage = totalExpenseAll.isZero()
        ? 0
        : c.total.dividedBy(totalExpenseAll).times(100).toNumber();

      return {
        id: c.id,
        name: c.name,
        color: c.color,
        icon: c.icon,
        amount: c.total.toNumber(),
        percentage: Math.round(percentage * 10) / 10,
      };
    });

    return {
      totalExpense: totalExpenseAll.toNumber(),
      items: items.sort((a, b) => b.amount - a.amount),
    };
  }
}
