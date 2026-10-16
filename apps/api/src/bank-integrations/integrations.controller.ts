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
import { SepayProvider } from './sepay/sepay.provider';
import { SynchronizationService } from './synchronization/synchronization.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';
import Decimal from 'decimal.js';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly sepayProvider: SepayProvider,
    private readonly syncService: SynchronizationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public Webhook endpoint for SePay.
   * Handles real-time transaction notifications for MB Bank.
   */
  @Post('sepay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: any,
  ) {
    const isValid = await this.sepayProvider.verifyWebhook(headers, payload);
    if (!isValid) {
      throw new UnauthorizedException('Invalid SePay webhook authentication');
    }

    const normalized = await this.sepayProvider.parseWebhook(payload);
    if (normalized.length === 0) {
      return { success: true, message: 'No actionable transactions in webhook payload' };
    }

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
      await this.syncService.ingestTransactions(targetUserId, 'SEPAY', normalized);
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
    return this.handleSepayWebhook(headers, payload);
  }

  /**
   * Get provider capabilities and integration status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus(@CurrentUser() user: UserPayload) {
    const sepayCaps = this.sepayProvider.getCapabilities();
    const lastSyncRun = await this.prisma.syncRun.findFirst({
      where: { provider: 'SEPAY' },
      orderBy: { createdAt: 'desc' },
    });

    const localAccount = await this.prisma.account.findFirst({
      where: { userId: user.userId },
      orderBy: { createdAt: 'asc' },
    });

    return {
      providers: [
        {
          name: 'SePay',
          providerKey: 'SEPAY',
          capabilities: sepayCaps,
          lastSync: lastSyncRun,
          localAccount,
          status: 'CONNECTED',
        },
      ],
    };
  }

  /**
   * Trigger on-demand sync from SePay API
   */
  @Post('sync')
  @UseGuards(JwtAuthGuard)
  async triggerSync(
    @CurrentUser() user: UserPayload,
    @Body() body?: { provider?: string; days?: number },
    @Query('days') queryDays?: string,
  ) {
    const days = body?.days || (queryDays ? parseInt(queryDays, 10) : 365);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const page = await this.sepayProvider.fetchTransactions({
      startDate,
      perPage: 5000,
    });

    const result = await this.syncService.ingestTransactions(
      user.userId,
      'SEPAY',
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
    let account = body.accountNumber
      ? await this.prisma.account.findFirst({
          where: { accountNumber: body.accountNumber, userId: user.userId },
        })
      : await this.prisma.account.findFirst({
          where: { userId: user.userId },
          orderBy: { createdAt: 'asc' },
        });

    if (!account) {
      account = await this.prisma.account.create({
        data: {
          userId: user.userId,
          displayName: body.accountNumber ? `MB Bank (${body.accountNumber})` : 'MB Bank',
          bankName: 'MB Bank',
          accountNumber: body.accountNumber || 'MB_DEFAULT',
          provider: 'SEPAY',
          balance: new Decimal(body.balance || 0),
          currency: 'VND',
        },
      });
    } else {
      account = await this.prisma.account.update({
        where: { id: account.id },
        data: {
          balance: new Decimal(body.balance || 0),
          provider: 'SEPAY',
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
}
