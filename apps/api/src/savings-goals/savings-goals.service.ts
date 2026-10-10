import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateSavingsGoalDto, UpdateSavingsGoalDto } from './dto/savings.dto';
import Decimal from 'decimal.js';

export interface SavingsGoalDetail {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  remainingAmount: number;
  percentageAchieved: number;
  targetDate: Date;
  daysRemaining: number;
  monthlyRequiredSavings: number;
}

@Injectable()
export class SavingsGoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string): Promise<SavingsGoalDetail[]> {
    const goals = await this.prisma.savingsGoal.findMany({
      where: { userId },
      orderBy: { targetDate: 'asc' },
    });

    return goals.map((goal) => this.formatGoalDetail(goal));
  }

  async findOne(userId: string, id: string): Promise<SavingsGoalDetail> {
    const goal = await this.prisma.savingsGoal.findFirst({
      where: { id, userId },
    });
    if (!goal) {
      throw new NotFoundException(`Savings goal ${id} not found`);
    }
    return this.formatGoalDetail(goal);
  }

  async create(userId: string, dto: CreateSavingsGoalDto) {
    return this.prisma.savingsGoal.create({
      data: {
        userId,
        name: dto.name,
        targetAmount: new Decimal(dto.targetAmount),
        targetDate: new Date(dto.targetDate),
        currentAmount: dto.currentAmount !== undefined ? new Decimal(dto.currentAmount) : new Decimal(0),
      },
    });
  }

  async update(userId: string, id: string, dto: UpdateSavingsGoalDto) {
    await this.findOne(userId, id);
    return this.prisma.savingsGoal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.targetAmount !== undefined && { targetAmount: new Decimal(dto.targetAmount) }),
        ...(dto.targetDate !== undefined && { targetDate: new Date(dto.targetDate) }),
        ...(dto.currentAmount !== undefined && { currentAmount: new Decimal(dto.currentAmount) }),
      },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.savingsGoal.delete({ where: { id } });
  }

  private formatGoalDetail(goal: any): SavingsGoalDetail {
    const target = new Decimal(goal.targetAmount.toString());
    const current = new Decimal(goal.currentAmount.toString());
    const remaining = Decimal.max(0, target.minus(current));

    const percentage = target.isZero()
      ? 0
      : current.dividedBy(target).times(100).toNumber();

    const now = new Date();
    const targetDate = new Date(goal.targetDate);
    const diffTime = targetDate.getTime() - now.getTime();
    const daysRemaining = Math.max(0, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));
    const monthsRemaining = Math.max(1, Math.ceil(daysRemaining / 30));

    const monthlyRequired = remaining.isZero()
      ? 0
      : remaining.dividedBy(monthsRemaining).toNumber();

    return {
      id: goal.id,
      name: goal.name,
      targetAmount: target.toNumber(),
      currentAmount: current.toNumber(),
      remainingAmount: remaining.toNumber(),
      percentageAchieved: Math.round(percentage * 10) / 10,
      targetDate,
      daysRemaining,
      monthlyRequiredSavings: Math.round(monthlyRequired),
    };
  }
}
