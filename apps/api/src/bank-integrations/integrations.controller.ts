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
} from '@nestjs/common';
import { SepayProvider } from './sepay/sepay.provider';
import { SynchronizationService } from './synchronization/synchronization.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';

@Controller('integrations')
export class IntegrationsController {
  constructor(
    private readonly sepayProvider: SepayProvider,
    private readonly syncService: SynchronizationService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Public Webhook endpoint for SePay.
   * Authenticates using SePay token and responds with { success: true }
   */
  @Post('sepay/webhook')
  @HttpCode(HttpStatus.OK)
  async handleSepayWebhook(
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() payload: any,
  ) {
    const isValid = await this.sepayProvider.verifyWebhook(headers, payload);
    if (!isValid) {
      throw new UnauthorizedException('Invalid SePay webhook authorization');
    }

    const normalized = await this.sepayProvider.parseWebhook(payload);
    if (normalized.length === 0) {
      return { success: true, message: 'No valid transactions found in payload' };
    }

    // Default to the first user or matching account user
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

  /**
   * Get provider capabilities and integration status
   */
  @Get('status')
  @UseGuards(JwtAuthGuard)
  async getStatus() {
    const sepayCaps = this.sepayProvider.getCapabilities();
    const lastSyncRun = await this.prisma.syncRun.findFirst({
      where: { provider: 'SEPAY' },
      orderBy: { createdAt: 'desc' },
    });

    return {
      providers: [
        {
          name: 'SePay',
          providerKey: 'SEPAY',
          capabilities: sepayCaps,
          lastSync: lastSyncRun,
          status: 'CONNECTED',
        },
        {
          name: 'MB Bank Web API (Trực tiếp)',
          providerKey: 'MBBANK',
          capabilities: {
            providerName: 'MBBANK',
            supportsIncoming: false,
            supportsOutgoing: false,
            supportsHistoricalSync: false,
            supportsWebhook: false,
            requiresManualVerification: true,
            disclosures: [
              'Chưa kích hoạt: Để đảm bảo an toàn tuyệt đối, hệ thống tuân thủ nghiêm ngặt không lưu mật khẩu hoặc session trái phép.',
              'Đang sử dụng kênh tích hợp chuẩn qua SePay Webhook và đối soát tự động.',
            ],
          },
          status: 'NOT_CONFIGURED',
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
    @Body() body: { provider?: string; days?: number },
  ) {
    const days = body.days || 3;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const page = await this.sepayProvider.fetchTransactions({
      startDate,
      perPage: 50,
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
    const mockId = `MOCK_${Date.now()}`;
    const normalized = await this.sepayProvider.parseWebhook({
      id: mockId,
      gateway: payload.gateway || 'MBBank',
      transactionDate: new Date().toISOString().replace('T', ' ').slice(0, 19),
      accountNumber: payload.accountNumber || 'MBBANK_DEFAULT',
      code: `CODE_${Date.now()}`,
      content: payload.content,
      transferType: payload.transferType,
      transferAmount: payload.transferAmount,
      description: payload.content,
    });

    const result = await this.syncService.ingestTransactions(
      user.userId,
      'SEPAY',
      normalized,
    );

    return { success: true, result };
  }
}
