import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRecurringDto, UpdateRecurringDto } from './dto/recurring.dto';
import Decimal from 'decimal.js';

export interface UpcomingObligation {
  id: string;
  name: string;
  amount: number;
  dueDate: Date;
  daysRemaining: number;
  isObligation: boolean;
  isDueSoon: boolean; // due within 7 days
  isInsufficientFunds: boolean;
}

@Injectable()
export class RecurringTransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.recurringTransaction.findMany({
      where: { userId },
      orderBy: { dayOfMonth: 'asc' },
    });
  }

  async findOne(userId: string, id: string) {
    const item = await this.prisma.recurringTransaction.findFirst({
      where: { id, userId },
    });
    if (!item) {
      throw new NotFoundException(`Recurring transaction ${id} not found`);
    }
    return item;
  }

  async create(userId: string, dto: CreateRecurringDto) {
    return this.prisma.recurringTransaction.create({
      data: {
        userId,
        name: dto.name,
        amount: new Decimal(dto.amount),
        direction: dto.direction,
        categoryId: dto.categoryId,
        dayOfMonth: dto.dayOfMonth,
        dueDateDescription: dto.dueDateDescription,
        isObligation: dto.isObligation ?? true,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateRecurringDto) {
    await this.findOne(userId, id);
    return this.prisma.recurringTransaction.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
        ...(dto.direction !== undefined && { direction: dto.direction }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.dayOfMonth !== undefined && { dayOfMonth: dto.dayOfMonth }),
        ...(dto.dueDateDescription !== undefined && { dueDateDescription: dto.dueDateDescription }),
        ...(dto.isObligation !== undefined && { isObligation: dto.isObligation }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.recurringTransaction.delete({ where: { id } });
  }

  async getUpcomingObligations(
    userId: string,
    currentCashBalance: number,
  ): Promise<UpcomingObligation[]> {
    const active = await this.prisma.recurringTransaction.findMany({
      where: { userId, isActive: true },
    });

    const now = new Date();
    const currentDay = now.getDate();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const obligations: UpcomingObligation[] = [];

    for (const item of active) {
      let targetYear = currentYear;
      let targetMonth = currentMonth;

      if (item.dayOfMonth < currentDay) {
        // Due next month
        targetMonth += 1;
        if (targetMonth > 11) {
          targetMonth = 0;
          targetYear += 1;
        }
      }

      const dueDate = new Date(targetYear, targetMonth, item.dayOfMonth, 23, 59, 59);
      const diffTime = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      const amountNum = new Decimal(item.amount.toString()).toNumber();
      const isInsufficient = item.isObligation && currentCashBalance < amountNum;

      obligations.push({
        id: item.id,
        name: item.name,
        amount: amountNum,
        dueDate,
        daysRemaining,
        isObligation: item.isObligation,
        isDueSoon: daysRemaining <= 7,
        isInsufficientFunds: isInsufficient,
      });
    }

    return obligations.sort((a, b) => a.daysRemaining - b.daysRemaining);
  }
}
