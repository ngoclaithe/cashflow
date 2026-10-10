import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Headers,
  UnauthorizedException,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
  Req,
} from '@nestjs/common';
import { GpmpayProvider } from './gpmpay/gpmpay.provider';
import { SynchronizationService } from './synchronization/synchronization.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';
import Decimal from 'decimal.js';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly gpmpayProvider: GpmpayProvider,
    private readonly syncService: SynchronizationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public Webhook endpoint for GPM Pay.
   * Handles real-time transaction notifications for MB Bank.
   */
  @Post('gpmpay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleGpmpayWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: any,
    @Req() req: any,
  ) {
    const rawBody = req.rawBody || JSON.stringify(payload);
    const isValid = await this.gpmpayProvider.verifyWebhook(headers, payload, rawBody);
    if (!isValid) {
      throw new UnauthorizedException('Invalid GPM Pay webhook signature');
    }

    const normalized = await this.gpmpayProvider.parseWebhook(payload);
    if (normalized.length === 0) {
      return { success: true, message: 'No actionable transactions in webhook payload' };
    }

    // Default to matching account user or system user
    let targetUserId: string | null = null;
    const matchingAccount = await this.prisma.account.findFirst({
      where: { accountNumber: normalized[0].accountNumber },
    });

    if (matchingAccount) {
      targetUserId = matchingAccount.userId;
    } else {
      const defaultUser = await this.prisma.user.findFirst();
      if (defaultUser) targetUserId = defaultUser.id;
    }

    if (targetUserId) {
      await this.syncService.ingestTransactions(targetUserId, 'GPMPAY', normalized);
    }

    return { success: true };
  }

  /** Alias webhook for standard root path */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  async handleGenericWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: any,
    @Req() req: any,
  ) {
    return this.handleGpmpayWebhook(headers, payload, req);
  }

  /** Legacy webhook alias to prevent broken external calls */
  @Post('sepay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleLegacySepayWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: any,
    @Req() req: any,
  ) {
    return this.handleGpmpayWebhook(headers, payload, req);
  }

  /**
   * Get provider capabilities and integration status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus() {
    const gpmpayCaps = this.gpmpayProvider.getCapabilities();
    const lastSyncRun = await this.prisma.syncRun.findFirst({
      where: { provider: 'GPMPAY' },
      orderBy: { createdAt: 'desc' },
    });

    const bankAccounts = await this.gpmpayProvider.getBankAccounts();
    const localAccount = await this.prisma.account.findFirst({
      where: { accountNumber: '1468651509999' },
    });

    return {
      providers: [
        {
          name: 'GPM Pay',
          providerKey: 'GPMPAY',
          capabilities: gpmpayCaps,
          lastSync: lastSyncRun,
          bankAccounts,
          localAccount,
          status: 'CONNECTED',
        },
      ],
    };
  }

  /**
   * Trigger on-demand sync from GPM Pay API
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async triggerSync(
    @CurrentUser() user: UserPayload,
    @Body() body?: { provider?: string; days?: number },
    @Query('days') queryDays?: string,
  ) {
    const days = body?.days || (queryDays ? parseInt(queryDays, 10) : 30);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const page = await this.gpmpayProvider.fetchTransactions({
      startDate,
      perPage: 50,
    });

    const result = await this.syncService.ingestTransactions(
      user.userId,
      'GPMPAY',
      page.transactions,
    );

    return {
      success: true,
      result,
    };
  }

  /**
   * Calibrate / Set actual real MB Bank balance manually
   */
  @Post('calibrate-balance')
  @UseGuards(JwtAuthGuard)
  async calibrateBalance(
    @CurrentUser() user: UserPayload,
    @Body() body: { balance: number; accountNumber?: string },
  ) {
    const targetAccountNum = body.accountNumber || '1468651509999';
    let account = await this.prisma.account.findFirst({
      where: { accountNumber: targetAccountNum, userId: user.userId },
    });

    if (!account) {
      account = await this.prisma.account.create({
        data: {
          userId: user.userId,
          displayName: 'MB Bank (1468651509999)',
          bankName: 'MB Bank',
          accountNumber: targetAccountNum,
          accountHolder: 'LAI THE NGOC',
          provider: 'GPMPAY',
          balance: new Decimal(body.balance || 0),
          currency: 'VND',
        },
      });
    } else {
      account = await this.prisma.account.update({
        where: { id: account.id },
        data: {
          balance: new Decimal(body.balance || 0),
          provider: 'GPMPAY',
        },
      });
    }

    return {
      success: true,
      account,
      message: `Đã cập nhật số dư thực MB Bank: ${body.balance.toLocaleString('vi-VN')} đ`,
    };
  }

  /**
   * List sync history
   */
  @Get('sync-runs')
  @UseGuards(JwtAuthGuard)
  async getSyncRuns(@Query('limit') limit?: string) {
    const take = limit ? Math.min(Number(limit), 50) : 20;
    return this.prisma.syncRun.findMany({
      take,
      orderBy: { createdAt: 'desc' },
      include: { account: true },
    });
  }

  /**
   * Simulator: Create test transaction via GPM Pay SDK simulator
   */
  @Post('simulate')
  @UseGuards(JwtAuthGuard)
  async simulateTransaction(
    @CurrentUser() user: UserPayload,
    @Body()
    body: {
      amount: number;
      transferContent: string;
      type?: 'IN' | 'OUT';
    },
  ) {
    try {
      const res = await this.gpmpayProvider.simulateTransaction({
        amount: body.amount,
        transferContent: body.transferContent,
        type: body.type || 'IN',
      });

      // Also ingest into local database so it reflects immediately
      const normalized = await this.gpmpayProvider.parseWebhook({
        id: res.transaction.id,
        transferAmount: res.transaction.amount,
        transferType: (res.transaction.type || 'IN').toLowerCase(),
        content: res.transaction.transferContent,
        accountNumber: '1468651509999',
        referenceCode: res.transaction.referenceCode,
        gateway: 'MB',
      });

      if (normalized.length > 0) {
        await this.syncService.ingestTransactions(user.userId, 'GPMPAY', normalized);
      }

      return {
        success: true,
        simulation: res,
      };
    } catch (err: any) {
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Ingest a test webhook payload (useful for testing or staging)
   */
  @Post('mock-webhook')
  @UseGuards(JwtAuthGuard)
  async ingestMockWebhook(
    @CurrentUser() user: UserPayload,
    @Body()
    payload: {
      accountNumber?: string;
      transferAmount: number;
      transferType: 'in' | 'out';
      content: string;
      gateway?: string;
    },
  ) {
    const mockId = `GPM_MOCK_${Date.now()}`;
    const normalized = await this.gpmpayProvider.parseWebhook({
      id: mockId,
      gateway: payload.gateway || 'MB',
      transactionDate: new Date().toISOString(),
      accountNumber: payload.accountNumber || '1468651509999',
      referenceCode: `MB_${Date.now()}`,
      content: payload.content,
      transferType: payload.transferType,
      transferAmount: payload.transferAmount,
    });

    const result = await this.syncService.ingestTransactions(
      user.userId,
      'GPMPAY',
      normalized,
    );

    return { success: true, result };
  }
}
