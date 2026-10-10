import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CategorizationRulesService } from '../../categorization-rules/categorization-rules.service';
import { NormalizedBankTransaction } from '../bank-provider.interface';
import { SyncStatus, TransactionDirection } from '@prisma/client';
import * as crypto from 'crypto';
import Decimal from 'decimal.js';

export interface SyncResult {
  syncRunId: string;
  status: SyncStatus;
  transactionsFetched: number;
  transactionsInserted: number;
  transactionsUpdated: number;
  transactionsSkipped: number;
  error?: string;
}

@Injectable()
export class SynchronizationService {
  private readonly logger = new Logger(SynchronizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly rulesService: CategorizationRulesService,
  ) {}

  /**
   * Ingest a batch of normalized bank transactions for a specific user.
   * Fully idempotent: duplicate external IDs or fingerprints are skipped.
   */
  async ingestTransactions(
    userId: string,
    provider: string,
    transactions: NormalizedBankTransaction[],
  ): Promise<SyncResult> {
    const syncRun = await this.prisma.syncRun.create({
      data: {
        provider,
        transactionsFetched: transactions.length,
        status: SyncStatus.PENDING,
      },
    });

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    try {
      for (const tx of transactions) {
        const result = await this.processSingleTransaction(userId, provider, tx);
        if (result === 'INSERTED') inserted++;
        else if (result === 'UPDATED') updated++;
        else skipped++;
      }

      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status: SyncStatus.SUCCESS,
          transactionsInserted: inserted,
          transactionsUpdated: updated,
          transactionsSkipped: skipped,
        },
      });

      return {
        syncRunId: syncRun.id,
        status: SyncStatus.SUCCESS,
        transactionsFetched: transactions.length,
        transactionsInserted: inserted,
        transactionsUpdated: updated,
        transactionsSkipped: skipped,
      };
    } catch (error: any) {
      this.logger.error(`Sync failed for provider ${provider}: ${error.message}`);
      await this.prisma.syncRun.update({
        where: { id: syncRun.id },
        data: {
          finishedAt: new Date(),
          status: SyncStatus.FAILED,
          transactionsInserted: inserted,
          transactionsUpdated: updated,
          transactionsSkipped: skipped,
          errorSummary: error.message,
        },
      });

      return {
        syncRunId: syncRun.id,
        status: SyncStatus.FAILED,
        transactionsFetched: transactions.length,
        transactionsInserted: inserted,
        transactionsUpdated: updated,
        transactionsSkipped: skipped,
        error: error.message,
      };
    }
  }

  private async processSingleTransaction(
    userId: string,
    provider: string,
    tx: NormalizedBankTransaction,
  ): Promise<'INSERTED' | 'UPDATED' | 'SKIPPED'> {
    // 1. Locate or create account
    const account = await this.ensureAccount(userId, provider, tx);

    // 2. Generate conservative deduplication fingerprint
    const fingerprint = this.computeFingerprint(account.id, tx);

    // 3. Check for existing transaction
    const existing = await this.prisma.transaction.findFirst({
      where: {
        accountId: account.id,
        OR: [
          { externalTransactionId: tx.externalTransactionId },
          { transactionFingerprint: fingerprint },
        ],
      },
    });

    if (existing) {
      // Idempotency: Do not duplicate.
      // If user had manually overridden category, preserve it!
      if (!existing.userCategoryOverride && !existing.categoryId) {
        const matchedCategory = await this.rulesService.matchCategory(userId, {
          description: tx.description,
          counterparty: tx.counterparty,
          amount: tx.amount,
          provider: tx.gateway || provider,
        });

        if (matchedCategory) {
          await this.prisma.transaction.update({
            where: { id: existing.id },
            data: { categoryId: matchedCategory },
          });
          return 'UPDATED';
        }
      }
      return 'SKIPPED';
    }

    // 4. Match category using rule engine
    const matchedCategoryId = await this.rulesService.matchCategory(userId, {
      description: tx.description,
      counterparty: tx.counterparty,
      amount: tx.amount,
      provider: tx.gateway || provider,
    });

    // 5. Detect internal transfers
    const isInternalTransfer = await this.detectInternalTransfer(userId, tx);

    // 6. Insert new transaction atomically inside transaction
    await this.prisma.$transaction(async (prisma) => {
      await prisma.transaction.create({
        data: {
          accountId: account.id,
          userId,
          provider,
          externalTransactionId: tx.externalTransactionId,
          transactionFingerprint: fingerprint,
          transactionDate: tx.transactionDate,
          bookedAt: tx.bookedAt,
          amount: new Decimal(tx.amount),
          currency: tx.currency,
          direction: isInternalTransfer ? TransactionDirection.TRANSFER : tx.direction,
          description: tx.description,
          counterparty: tx.counterparty,
          code: tx.code,
          categoryId: matchedCategoryId,
          isInternalTransfer,
          sourcePayload: tx.rawPayload ?? undefined,
        },
      });

      // Update account balance
      if (tx.accumulatedBalance !== undefined) {
        await prisma.account.update({
          where: { id: account.id },
          data: { balance: new Decimal(tx.accumulatedBalance) },
        });
      } else {
        const delta =
          tx.direction === TransactionDirection.INCOME
            ? new Decimal(tx.amount)
            : new Decimal(tx.amount).negated();
        await prisma.account.update({
          where: { id: account.id },
          data: {
            balance: {
              increment: delta,
            },
          },
        });
      }
    });

    return 'INSERTED';
  }

  private async ensureAccount(
    userId: string,
    provider: string,
    tx: NormalizedBankTransaction,
  ) {
    const existing = await this.prisma.account.findFirst({
      where: {
        userId,
        accountNumber: tx.accountNumber,
      },
    });

    if (existing) return existing;

    return this.prisma.account.create({
      data: {
        userId,
        provider,
        accountNumber: tx.accountNumber,
        bankName: tx.gateway || 'MB Bank',
        displayName: `${tx.gateway || 'Bank'} (${tx.accountNumber.slice(-4)})`,
        balance: tx.accumulatedBalance !== undefined ? new Decimal(tx.accumulatedBalance) : new Decimal(0),
        currency: tx.currency || 'VND',
      },
    });
  }

  private computeFingerprint(accountId: string, tx: NormalizedBankTransaction): string {
    const raw = `${accountId}_${tx.transactionDate.toISOString().slice(0, 10)}_${tx.amount}_${tx.direction}_${tx.description.trim().toUpperCase()}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  private async detectInternalTransfer(
    userId: string,
    tx: NormalizedBankTransaction,
  ): Promise<boolean> {
    const userAccounts = await this.prisma.account.findMany({
      where: { userId },
      select: { accountNumber: true },
    });

    const accountNumbers = userAccounts
      .map((a) => a.accountNumber)
      .filter((n): n is string => Boolean(n));

    const descUpper = (tx.description || '').toUpperCase();
    for (const accNum of accountNumbers) {
      if (accNum !== tx.accountNumber && descUpper.includes(accNum.toUpperCase())) {
        return true;
      }
    }

    return false;
  }
}
