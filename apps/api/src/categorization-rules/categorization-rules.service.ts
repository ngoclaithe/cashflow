import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rule.dto';
import { RuleField, RuleOperator } from '@prisma/client';

export interface EvaluatableTransaction {
  description: string;
  counterparty?: string | null;
  amount: number | string;
  provider?: string | null;
}

@Injectable()
export class CategorizationRulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string) {
    return this.prisma.categorizationRule.findMany({
      where: { userId },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
      include: {
        category: {
          select: { id: true, name: true, color: true, icon: true, type: true },
        },
      },
    });
  }

  async findOne(userId: string, id: string) {
    const rule = await this.prisma.categorizationRule.findFirst({
      where: { id, userId },
      include: { category: true },
    });
    if (!rule) {
      throw new NotFoundException(`Rule ${id} not found`);
    }
    return rule;
  }

  async create(userId: string, dto: CreateRuleDto) {
    return this.prisma.categorizationRule.create({
      data: {
        userId,
        name: dto.name,
        priority: dto.priority ?? 0,
        field: dto.field,
        operator: dto.operator,
        value: dto.value,
        categoryId: dto.categoryId,
        isActive: dto.isActive ?? true,
      },
      include: { category: true },
    });
  }

  async update(userId: string, id: string, dto: UpdateRuleDto) {
    await this.findOne(userId, id);
    return this.prisma.categorizationRule.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.field !== undefined && { field: dto.field }),
        ...(dto.operator !== undefined && { operator: dto.operator }),
        ...(dto.value !== undefined && { value: dto.value }),
        ...(dto.categoryId !== undefined && { categoryId: dto.categoryId }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: { category: true },
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    return this.prisma.categorizationRule.delete({
      where: { id },
    });
  }

  /**
   * Deterministically evaluates active rules in priority order.
   * Returns matched categoryId or null if no rule matched.
   */
  async matchCategory(userId: string, tx: EvaluatableTransaction): Promise<string | null> {
    const rules = await this.prisma.categorizationRule.findMany({
      where: { userId, isActive: true },
      orderBy: [{ priority: 'desc' }, { createdAt: 'asc' }],
    });

    for (const rule of rules) {
      if (this.isRuleMatch(rule, tx)) {
        return rule.categoryId;
      }
    }

    return null;
  }

  /**
   * Evaluates active rules against all un-overridden transactions and updates category.
   */
  async applyRulesToExisting(userId: string) {
    const transactions = await this.prisma.transaction.findMany({
      where: {
        userId,
        userCategoryOverride: false,
      },
    });

    let matchedCount = 0;
    for (const tx of transactions) {
      const matchedCategoryId = await this.matchCategory(userId, {
        description: tx.description,
        counterparty: tx.counterparty,
        amount: tx.amount.toString(),
        provider: tx.provider,
      });

      if (matchedCategoryId && matchedCategoryId !== tx.categoryId) {
        await this.prisma.transaction.update({
          where: { id: tx.id },
          data: { categoryId: matchedCategoryId },
        });
        matchedCount++;
      }
    }

    return { total: transactions.length, matchedCount };
  }

  isRuleMatch(
    rule: { field: RuleField; operator: RuleOperator; value: string },
    tx: EvaluatableTransaction,
  ): boolean {
    let targetValue = '';
    switch (rule.field) {
      case RuleField.DESCRIPTION:
        targetValue = tx.description || '';
        break;
      case RuleField.COUNTERPARTY:
        targetValue = tx.counterparty || '';
        break;
      case RuleField.AMOUNT:
        targetValue = String(tx.amount || '');
        break;
      case RuleField.GATEWAY:
        targetValue = tx.provider || '';
        break;
    }

    const normalizedTarget = targetValue.trim().toUpperCase();
    const normalizedPattern = rule.value.trim().toUpperCase();

    switch (rule.operator) {
      case RuleOperator.CONTAINS:
        return normalizedTarget.includes(normalizedPattern);
      case RuleOperator.EQUALS:
        return normalizedTarget === normalizedPattern;
      case RuleOperator.STARTS_WITH:
        return normalizedTarget.startsWith(normalizedPattern);
      case RuleOperator.ENDS_WITH:
        return normalizedTarget.endsWith(normalizedPattern);
      case RuleOperator.REGEX:
        try {
          const regex = new RegExp(rule.value, 'i');
          return regex.test(targetValue);
        } catch {
          return false;
        }
      default:
        return false;
    }
  }
}
