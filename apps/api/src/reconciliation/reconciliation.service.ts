import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { SepayProvider } from '../bank-integrations/sepay/sepay.provider';
import { SynchronizationService } from '../bank-integrations/synchronization/synchronization.service';
@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sepayProvider: SepayProvider,
    private readonly syncService: SynchronizationService,
  ) {}

  /**
   * Scheduled daily reconciliation at 23:30 Asia/Ho_Chi_Minh.
   * Uses overlapping 48-hour window to catch delayed bank postings.
   */
  @Cron('30 23 * * *', {
    timeZone: 'Asia/Ho_Chi_Minh',
  })
  async scheduledDailyReconciliation() {
    this.logger.log('Starting scheduled daily reconciliation (23:30 Asia/Ho_Chi_Minh)...');
    await this.runReconciliation(2);
  }

  /**
   * Run reconciliation across all users and accounts for the specified window (in days)
   */
  async runReconciliation(lookbackDays = 2) {
    const windowEnd = new Date();
    const windowStart = new Date();
    windowStart.setDate(windowStart.getDate() - lookbackDays);

    const users = await this.prisma.user.findMany({
      select: { id: true, email: true },
    });

    let totalFetched = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let discrepanciesCount = 0;

    for (const user of users) {
      try {
        const syncPage = await this.sepayProvider.fetchTransactions({
          startDate: windowStart,
          endDate: windowEnd,
          perPage: 500,
        });

        totalFetched += syncPage.transactions.length;

        const result = await this.syncService.ingestTransactions(
          user.id,
          'SEPAY',
          syncPage.transactions,
        );

        totalInserted += result.transactionsInserted;
        totalUpdated += result.transactionsUpdated;
      } catch (err: any) {
        discrepanciesCount++;
        this.logger.error(`Reconciliation error for user ${user.email}: ${err.message}`);
      }
    }

    const log = await this.prisma.reconciliationLog.create({
      data: {
        windowStart,
        windowEnd,
        status: discrepanciesCount === 0 ? 'COMPLETED' : 'WARNING',
        discrepanciesCount,
        details: {
          totalFetched,
          totalInserted,
          totalUpdated,
          lookbackDays,
        },
      },
    });

    return {
      logId: log.id,
      status: log.status,
      windowStart,
      windowEnd,
      totalFetched,
      totalInserted,
      totalUpdated,
      discrepanciesCount,
    };
  }

  async getLatestStatus() {
    return this.prisma.reconciliationLog.findFirst({
      orderBy: { runAt: 'desc' },
    });
  }

  async getHistory(limit = 10) {
    return this.prisma.reconciliationLog.findMany({
      take: limit,
      orderBy: { runAt: 'desc' },
    });
  }
}
