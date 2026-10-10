import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  QueryTransactionsDto,
  CreateTransactionDto,
  UpdateTransactionDto,
} from './dto/transaction.dto';
import { TransactionDirection } from '@prisma/client';
import Decimal from 'decimal.js';

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, query: QueryTransactionsDto) {
    const page = Math.max(Number(query.page || 1), 1);
    const limit = Math.min(Math.max(Number(query.limit || 20), 1), 100);
    const skip = (page - 1) * limit;

    const where: any = { userId };

    if (query.accountId) {
      where.accountId = query.accountId;
    }

    if (query.categoryId) {
      where.categoryId = query.categoryId;
    }

    if (query.direction) {
      where.direction = query.direction;
    }

    if (query.startDate || query.endDate) {
      where.transactionDate = {};
      if (query.startDate) {
        where.transactionDate.gte = new Date(query.startDate);
      }
      if (query.endDate) {
        const end = new Date(query.endDate);
        end.setHours(23, 59, 59, 999);
        where.transactionDate.lte = end;
      }
    }

    if (query.search) {
      where.OR = [
        { description: { contains: query.search, mode: 'insensitive' } },
        { counterparty: { contains: query.search, mode: 'insensitive' } },
        { code: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.prisma.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { transactionDate: 'desc' },
        include: {
          category: {
            select: { id: true, name: true, color: true, icon: true, type: true },
          },
          account: {
            select: { id: true, displayName: true, accountNumber: true, bankName: true },
          },
        },
      }),
      this.prisma.transaction.count({ where }),
    ]);

    return {
      items,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(userId: string, id: string) {
    const tx = await this.prisma.transaction.findFirst({
      where: { id, userId },
      include: {
        category: true,
        account: true,
      },
    });

    if (!tx) {
      throw new NotFoundException(`Transaction ${id} not found`);
    }

    return tx;
  }

  async create(userId: string, dto: CreateTransactionDto) {
    const account = await this.prisma.account.findFirst({
      where: { id: dto.accountId, userId },
    });
    if (!account) {
      throw new NotFoundException('Account not found');
    }

    const amountDecimal = new Decimal(Math.abs(dto.amount));

    return this.prisma.$transaction(async (prisma) => {
      const tx = await prisma.transaction.create({
        data: {
          userId,
          accountId: dto.accountId,
          amount: amountDecimal,
          direction: dto.direction,
          description: dto.description,
          transactionDate: new Date(dto.transactionDate),
          categoryId: dto.categoryId,
          userCategoryOverride: Boolean(dto.categoryId),
          counterparty: dto.counterparty,
          provider: 'MANUAL',
        },
        include: { category: true, account: true },
      });

      // Update account balance
      const delta =
        dto.direction === TransactionDirection.INCOME
          ? amountDecimal
          : amountDecimal.negated();

      await prisma.account.update({
        where: { id: dto.accountId },
        data: { balance: { increment: delta } },
      });

      return tx;
    });
  }

  async update(userId: string, id: string, dto: UpdateTransactionDto) {
    const existing = await this.findOne(userId, id);

    const data: any = {};
    if (dto.categoryId !== undefined) {
      data.categoryId = dto.categoryId;
      data.userCategoryOverride = true; // Mark as explicit user override
    }
    if (dto.description !== undefined) {
      data.description = dto.description;
    }
    if (dto.isInternalTransfer !== undefined) {
      data.isInternalTransfer = dto.isInternalTransfer;
      if (dto.isInternalTransfer) {
        data.direction = TransactionDirection.TRANSFER;
      }
    }

    return this.prisma.transaction.update({
      where: { id },
      data,
      include: { category: true, account: true },
    });
  }

  async reclassify(userId: string, id: string, categoryId: string) {
    await this.findOne(userId, id);
    return this.prisma.transaction.update({
      where: { id },
      data: {
        categoryId,
        userCategoryOverride: true,
      },
      include: { category: true, account: true },
    });
  }

  async remove(userId: string, id: string) {
    const tx = await this.findOne(userId, id);

    await this.prisma.$transaction(async (prisma) => {
      // Revert account balance effect
      const delta =
        tx.direction === TransactionDirection.INCOME
          ? new Decimal(tx.amount.toString()).negated()
          : new Decimal(tx.amount.toString());

      await prisma.account.update({
        where: { id: tx.accountId },
        data: { balance: { increment: delta } },
      });

      await prisma.transaction.delete({ where: { id } });
    });

    return { success: true };
  }
}
