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
        'Dữ liệu biến động số dư được đồng bộ qua cổng kết nối SePay API v2.',
        'SePay hỗ trợ nhận biến động số dư qua Webhook real-time.',
        'Giao dịch chi (tiền ra) và thu (tiền vào) được phân tích tự động từ sao kê.',
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
    const apiUrl = this.config.get<string>('SEPAY_API_URL') || 'https://my.sepay.vn/userapi';
    const targetAccount =
      options.accountNumber ||
      this.config.get<string>('SEPAY_ACCOUNT_NUMBER') ||
      '1468651509999';

    if (!apiKey || apiKey.startsWith('mock_')) {
      this.logger.log('Using mock mode for SePay fetchTransactions (no live API key)');
      return {
        transactions: [],
        hasMore: false,
        total: 0,
      };
    }

    try {
      const perPage = options.perPage || 100;
      const params: Record<string, any> = {
        limit: perPage,
      };

      if (targetAccount && targetAccount !== 'DEFAULT_ACCOUNT') {
        params.account_number = targetAccount;
      }

      if (options.startDate) {
        params.transaction_date_min = options.startDate
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19);
      }
      if (options.endDate) {
        params.transaction_date_max = options.endDate
          .toISOString()
          .replace('T', ' ')
          .slice(0, 19);
      }
      if (options.cursor) {
        params.since_id = options.cursor;
      }

      // SePay docs: GET https://my.sepay.vn/userapi/transactions/list
      const endpoint = apiUrl.endsWith('/transactions/list')
        ? apiUrl
        : `${apiUrl.replace(/\/+$/, '')}/transactions/list`;

      this.logger.log(`Fetching transactions from SePay: ${endpoint} for account ${params.account_number || 'ALL'}`);

      const response = await axios.get(endpoint, {
        params,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 15000,
      });

      const rawList =
        response.data?.transactions ||
        response.data?.data ||
        [];

      const normalized = rawList
        .map((item: any) => this.normalizeTransaction(item))
        .filter((item: any): item is NormalizedBankTransaction => item !== null);

      this.logger.log(`Successfully fetched and normalized ${normalized.length} transactions from SePay`);

      return {
        transactions: normalized,
        hasMore: normalized.length >= perPage,
        total: response.data?.count_transactions || normalized.length,
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
    const dateStr = item.transaction_date || item.transactionDate;
    if (dateStr) {
      date = new Date(dateStr);
      if (isNaN(date.getTime())) {
        date = new Date();
      }
    }

    // Amount & Direction: Check amount_in / amount_out (SePay API v2 standard)
    let amount = 0;
    let direction: TransactionDirection = TransactionDirection.EXPENSE;

    const amountIn = item.amount_in !== undefined && item.amount_in !== null ? Number(item.amount_in) : 0;
    const amountOut = item.amount_out !== undefined && item.amount_out !== null ? Number(item.amount_out) : 0;

    if (amountIn > 0) {
      amount = amountIn;
      direction = TransactionDirection.INCOME;
    } else if (amountOut > 0) {
      amount = amountOut;
      direction = TransactionDirection.EXPENSE;
    } else {
      // Fallback for Webhook payloads: transferType & transferAmount
      const rawAmount = Number(item.transferAmount || item.transfer_amount || item.amount || 0);
      amount = Math.abs(rawAmount);
      const typeStr = String(item.transferType || item.transfer_type || 'in').toLowerCase();
      direction = typeStr === 'out' ? TransactionDirection.EXPENSE : TransactionDirection.INCOME;
    }

    const description =
      item.transaction_content ||
      item.transactionContent ||
      item.content ||
      item.description ||
      '';

    const code =
      item.code ||
      item.reference_number ||
      item.referenceNumber ||
      item.referenceCode ||
      undefined;

    const fallbackAccount = this.config.get<string>('SEPAY_ACCOUNT_NUMBER') || '1468651509999';
    const accountNumber = String(
      item.account_number ||
      item.accountNumber ||
      fallbackAccount
    );

    const gateway =
      item.bank_brand_name ||
      item.bankBrandName ||
      item.gateway ||
      'MBBank';

    const accumulatedBalance = item.accumulated ? Number(item.accumulated) : undefined;

    return {
      externalTransactionId: externalId,
      transactionDate: date,
      amount,
      currency: 'VND',
      direction,
      description,
      counterparty: item.sub_account || item.subAccount || item.gateway || undefined,
      code,
      accountNumber,
      gateway,
      accumulatedBalance,
      rawPayload: item,
    };
  }
}
