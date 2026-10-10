import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBudgetDto, UpdateBudgetDto } from './dto/budget.dto';
import { BudgetPeriod, TransactionDirection } from '@prisma/client';
import Decimal from 'decimal.js';

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
  period: BudgetPeriod;
  startDate: Date;
  endDate: Date | null;
  isActive: boolean;
}

@Injectable()
export class BudgetsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<BudgetStatus[]> {
    const budgets = await this.prisma.budget.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true },
        },
      },
    });

    const results: BudgetStatus[] = [];
    for (const b of budgets) {
      const status = await this.calculateBudgetStatus(userId, b);
      results.push(status);
    }

    return results;
  }

  async findOne(userId: string, id: string): Promise<BudgetStatus> {
    const budget = await this.prisma.budget.findFirst({
      where: { id, userId },
      include: { category: true },
    });

    if (!budget) {
      throw new NotFoundException(`Budget ${id} not found`);
    }

    return this.calculateBudgetStatus(userId, budget);
  }

  async create(userId: string, dto: CreateBudgetDto) {
    const startDate = dto.startDate
      ? new Date(dto.startDate)
      : new Date(new Date().getFullYear(), new Date().getMonth(), 1);

    return this.prisma.budget.create({
      data: {
        userId,
        name: dto.name,
        amount: new Decimal(dto.amount),
        categoryId: dto.categoryId,
        period: dto.period || BudgetPeriod.MONTHLY,
        startDate,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateBudgetDto) {
    await this.findOne(userId, id);

    return this.prisma.budget.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.period !== undefined && { period: dto.period }),
        ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
        ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.budget.delete({ where: { id } });
  }

  private async calculateBudgetStatus(userId: string, budget: any): Promise<BudgetStatus> {
    const now = new Date();
    let rangeStart = new Date(budget.startDate);
    let rangeEnd: Date;

    if (budget.period === BudgetPeriod.MONTHLY) {
      rangeStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      rangeEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    } else {
      rangeEnd = budget.endDate ? new Date(budget.endDate) : new Date();
      rangeEnd.setHours(23, 59, 59, 999);
    }

    const where: any = {
      userId,
      direction: TransactionDirection.EXPENSE,
      isInternalTransfer: false,
      transactionDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    };

    if (budget.categoryId) {
      where.categoryId = budget.categoryId;
    }

    const transactions = await this.prisma.transaction.findMany({
      where,
      select: { amount: true },
    });

    let spentDecimal = new Decimal(0);
    for (const t of transactions) {
      spentDecimal = spentDecimal.plus(new Decimal(t.amount.toString()));
    }

    const limitDecimal = new Decimal(budget.amount.toString());
    const remainingDecimal = Decimal.max(0, limitDecimal.minus(spentDecimal));
    const percentage = limitDecimal.isZero()
      ? 0
      : spentDecimal.dividedBy(limitDecimal).times(100).toNumber();

    let alertLevel: 'OK' | 'INFO' | 'WARNING' | 'CRITICAL' = 'OK';
    if (percentage >= 100) {
      alertLevel = 'CRITICAL';
    } else if (percentage >= 90) {
      alertLevel = 'WARNING';
    } else if (percentage >= 70) {
      alertLevel = 'INFO';
    }

    return {
      id: budget.id,
      name: budget.name,
      categoryId: budget.categoryId,
      categoryName: budget.category?.name,
      categoryColor: budget.category?.color,
      limitAmount: limitDecimal.toNumber(),
      spentAmount: spentDecimal.toNumber(),
      remainingAmount: remainingDecimal.toNumber(),
      percentageUsed: Math.round(percentage * 10) / 10,
      alertLevel,
      period: budget.period,
      startDate: rangeStart,
      endDate: rangeEnd,
      isActive: budget.isActive,
    };
  }
}
