import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import {
  BankProvider,
  BankProviderCapabilities,
  BankSyncPage,
  NormalizedBankTransaction,
  TransactionSyncOptions,
} from '../bank-provider.interface';
import { TransactionDirection } from '@prisma/client';

@Injectable()
export class SepayProvider implements BankProvider {
  private readonly logger = new Logger(SepayProvider.name);

  constructor(private readonly config: ConfigService) {}

  getCapabilities(): BankProviderCapabilities {
    return {
      providerName: 'SEPAY',
      supportsIncoming: true,
      supportsOutgoing: true, // Note: outgoing depends on bank and SePay plan
      supportsHistoricalSync: true,
      supportsWebhook: true,
      requiresManualVerification: false,
      disclosures: [
        'SePay hỗ trợ nhận biến động số dư qua Webhook real-time.',
        'Hỗ trợ truy vấn lịch sử giao dịch qua SePay API v2.',
        'Giao dịch chi (tiền ra) phụ thuộc vào gói tài khoản ngân hàng và quyền truy cập cấp cho SePay.',
      ],
    };
  }

  async verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: unknown,
  ): Promise<boolean> {
    const configuredToken =
      this.config.get<string>('SEPAY_WEBHOOK_TOKEN') ||
      this.config.get<string>('SEPAY_WEBHOOK_API_KEY') ||
      this.config.get<string>('SEPAY_API_KEY');

    // If no token is configured in local development, allow for testing
    if (!configuredToken) {
      this.logger.warn('No SEPAY_WEBHOOK_TOKEN configured, bypassing verification for local dev');
      return true;
    }

    const authHeader = headers['authorization'] || headers['Authorization'];
    const authString = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!authString) {
      this.logger.warn('SePay webhook missing Authorization header');
      return false;
    }

    // SePay sends: "Apikey <TOKEN>" or "Bearer <TOKEN>"
    const cleanAuth = authString.replace(/^(Apikey|Bearer)\s+/i, '').trim();
    return cleanAuth === configuredToken;
  }

  async parseWebhook(payload: any): Promise<NormalizedBankTransaction[]> {
    if (!payload) return [];

    // Support single transaction object or array of transactions
    const items = Array.isArray(payload) ? payload : [payload];
    return items
      .map((item) => this.normalizeTransaction(item))
      .filter((item): item is NormalizedBankTransaction => item !== null);
  }

  async fetchTransactions(options: TransactionSyncOptions): Promise<BankSyncPage> {
    const apiKey = this.config.get<string>('SEPAY_API_KEY');
    const apiUrl = this.config.get<string>('SEPAY_API_URL') || 'https://userapi.sepay.vn/v2';

    if (!apiKey || apiKey.startsWith('mock_')) {
      this.logger.log('Using mock mode for SePay fetchTransactions (no live API key)');
      return {
        transactions: [],
        hasMore: false,
        total: 0,
      };
    }

    try {
      const page = options.page || 1;
      const perPage = options.perPage || 20;

      const params: Record<string, any> = {
        page,
        per_page: perPage,
      };

      if (options.startDate) {
        params.transaction_date_from = options.startDate.toISOString().replace('T', ' ').slice(0, 19);
      }
      if (options.endDate) {
        params.transaction_date_to = options.endDate.toISOString().replace('T', ' ').slice(0, 19);
      }

      const response = await axios.get(`${apiUrl}/transactions`, {
        params,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      });

      const rawList = response.data?.data || response.data?.transactions || [];
      const normalized = rawList
        .map((item: any) => this.normalizeTransaction(item))
        .filter((item: any): item is NormalizedBankTransaction => item !== null);

      return {
        transactions: normalized,
        hasMore: normalized.length >= perPage,
        total: response.data?.total || normalized.length,
      };
    } catch (error: any) {
      this.logger.error(`Failed to fetch transactions from SePay API: ${error.message}`);
      throw error;
    }
  }

  private normalizeTransaction(item: any): NormalizedBankTransaction | null {
    if (!item) return null;

    const externalId = String(item.id || item.transaction_id || '');
    if (!externalId) return null;

    // Parse date
    let date = new Date();
    if (item.transactionDate || item.transaction_date) {
      date = new Date(item.transactionDate || item.transaction_date);
      if (isNaN(date.getTime())) {
        date = new Date();
      }
    }

    // Direction: 'in' => INCOME, 'out' => EXPENSE
    const typeStr = String(item.transferType || item.transfer_type || 'in').toLowerCase();
    const direction = typeStr === 'out' ? TransactionDirection.EXPENSE : TransactionDirection.INCOME;

    // Amount: always absolute positive number
    const rawAmount = item.transferAmount || item.transfer_amount || item.amount || 0;
    const amount = Math.abs(Number(rawAmount));

    const accumulatedBalance = item.accumulated ? Number(item.accumulated) : undefined;

    return {
      externalTransactionId: externalId,
      transactionDate: date,
      amount,
      currency: 'VND',
      direction,
      description: item.content || item.description || '',
      counterparty: item.subAccount || item.gateway || undefined,
      code: item.code || item.referenceCode || undefined,
      accountNumber: String(item.accountNumber || item.account_number || 'DEFAULT_ACCOUNT'),
      gateway: item.gateway || 'MBBank',
      accumulatedBalance,
      rawPayload: item,
    };
  }
}
