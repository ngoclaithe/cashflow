import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  BankProvider,
  BankProviderCapabilities,
  BankSyncPage,
  NormalizedBankTransaction,
  TransactionSyncOptions,
} from '../bank-provider.interface';
import { TransactionDirection } from '@prisma/client';
import axios from 'axios';

@Injectable()
export class SepayProvider implements BankProvider {
  readonly providerName = 'SEPAY';
  private readonly logger = new Logger(SepayProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): BankProviderCapabilities {
    return {
      providerName: this.providerName,
      supportsIncoming: true,
      supportsOutgoing: true,
      supportsHistoricalSync: true,
      supportsWebhook: true,
      requiresManualVerification: false,
      disclosures: [
        'Đồng bộ giao dịch tự động qua SePay Open API & Webhook chính thức.',
        'Hỗ trợ đầy đủ lịch sử giao dịch tiền vào (thu nhập) và tiền ra (chi tiêu) của MB Bank.',
        'Không yêu cầu lưu trữ mật khẩu hay session ngân hàng trong hệ thống.',
      ],
    };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: unknown,
  ): Promise<boolean> {
    const webhookSecret = this.config.get<string>('SEPAY_WEBHOOK_SECRET');
    const apiToken = this.config.get<string>('SEPAY_API_TOKEN');

    if (!webhookSecret && !apiToken) {
      this.logger.warn('Neither SEPAY_WEBHOOK_SECRET nor SEPAY_API_TOKEN configured. Allowing webhook.');
      return true;
    }

    const authHeader = headers['authorization'] || headers['Authorization'];
    const authString = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!authString) {
      this.logger.warn('Missing Authorization header in SePay webhook');
      return true;
    }

    const token = authString.replace(/^(Apikey|Bearer)\s+/i, '').trim();
    if (webhookSecret && token === webhookSecret) return true;
    if (apiToken && token === apiToken) return true;

    this.logger.warn('Invalid authorization token in SePay webhook');
    return false;
  }

  async parseWebhook(payload: any): Promise<NormalizedBankTransaction[]> {
    if (!payload) return [];
    const items = Array.isArray(payload) ? payload : [payload];
    const results: NormalizedBankTransaction[] = [];

    for (const item of items) {
      if (!item) continue;
      const id = String(item.id || Date.now());
      const amountIn = Number(item.transferAmount || item.amount_in || item.amount || 0);
      const amountOut = Number(item.amount_out || 0);
      const transferType = (item.transferType || '').toLowerCase();

      const isIncome = transferType === 'in' || amountIn > 0;
      const amount = Math.round(isIncome ? (amountIn || amountOut) : (amountOut || amountIn));

      if (amount <= 0 || isNaN(amount)) continue;

      const dateStr = item.transactionDate || item.transaction_date;
      const txDate = dateStr ? new Date(dateStr) : new Date();

      results.push({
        externalTransactionId: id,
        transactionDate: isNaN(txDate.getTime()) ? new Date() : txDate,
        bookedAt: isNaN(txDate.getTime()) ? new Date() : txDate,
        amount,
        currency: 'VND',
        direction: isIncome ? TransactionDirection.INCOME : TransactionDirection.EXPENSE,
        description: item.content || item.transaction_content || 'Giao dịch MB Bank',
        code: item.code || item.reference_number || item.referenceCode,
        accountNumber: item.accountNumber || item.account_number || '',
        gateway: item.gateway || item.bank_brand_name || 'MBBank',
        accumulatedBalance: item.accumulated ? Number(item.accumulated) : undefined,
        rawPayload: item,
      });
    }

    return results;
  }

  async fetchTransactions(options: TransactionSyncOptions): Promise<BankSyncPage> {
    const apiToken = this.config.get<string>('SEPAY_API_TOKEN');
    if (!apiToken) {
      this.logger.warn('SEPAY_API_TOKEN is not configured in environment variables');
      return { transactions: [], hasMore: false, total: 0 };
    }

    const baseUrl = this.config.get<string>('SEPAY_API_URL') || 'https://my.sepay.vn/userapi';
    const limit = Math.min(options.perPage || 100, 5000);

    const params: Record<string, any> = { limit };
    if (options.accountNumber) {
      params.account_number = options.accountNumber;
    }
    if (options.startDate) {
      params.transaction_date_min = options.startDate.toISOString().slice(0, 10);
    }
    if (options.endDate) {
      params.transaction_date_max = options.endDate.toISOString().slice(0, 10);
    }

    try {
      this.logger.log(`Fetching transactions from SePay API: ${baseUrl}/transactions/list`);
      const response = await axios.get(`${baseUrl}/transactions/list`, {
        params,
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Cashflow/1.0',
        },
        timeout: 15000,
      });

      const rawList = response.data?.transactions || [];
      const normalized: NormalizedBankTransaction[] = [];

      for (const item of rawList) {
        if (!item) continue;
        const id = String(item.id);
        const amountIn = Number(item.amount_in || 0);
        const amountOut = Number(item.amount_out || 0);
        const isIncome = amountIn > 0;
        const amount = Math.round(isIncome ? amountIn : amountOut);

        if (amount <= 0 || isNaN(amount)) continue;

        const dateStr = item.transaction_date;
        const txDate = dateStr ? new Date(dateStr) : new Date();

        normalized.push({
          externalTransactionId: id,
          transactionDate: isNaN(txDate.getTime()) ? new Date() : txDate,
          bookedAt: isNaN(txDate.getTime()) ? new Date() : txDate,
          amount,
          currency: 'VND',
          direction: isIncome ? TransactionDirection.INCOME : TransactionDirection.EXPENSE,
          description: item.transaction_content || 'Giao dịch MB Bank',
          code: item.reference_number || item.code || undefined,
          accountNumber: item.account_number || '',
          gateway: item.bank_brand_name || 'MBBank',
          accumulatedBalance: item.accumulated ? Number(item.accumulated) : undefined,
          rawPayload: item,
        });
      }

      this.logger.log(`Successfully fetched ${normalized.length} transactions from SePay API`);

      return {
        transactions: normalized,
        hasMore: false,
        total: normalized.length,
      };
    } catch (err: any) {
      this.logger.error(`Error fetching transactions from SePay: ${err.message}`, err.stack);
      return { transactions: [], hasMore: false, total: 0 };
    }
  }
}
