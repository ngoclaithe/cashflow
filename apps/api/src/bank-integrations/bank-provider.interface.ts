import { TransactionDirection } from '@prisma/client';

export interface NormalizedBankTransaction {
  externalTransactionId: string;
  transactionDate: Date;
  bookedAt?: Date;
  amount: number;
  currency: string;
  direction: TransactionDirection;
  description: string;
  counterparty?: string;
  code?: string;
  accountNumber: string;
  gateway?: string;
  accumulatedBalance?: number;
  rawPayload: any;
}

export interface BankSyncPage {
  transactions: NormalizedBankTransaction[];
  hasMore: boolean;
  nextCursor?: string;
  total?: number;
}

export interface TransactionSyncOptions {
  startDate?: Date;
  endDate?: Date;
  cursor?: string;
  page?: number;
  perPage?: number;
  accountNumber?: string;
}

export interface BankProviderCapabilities {
  providerName: string;
  supportsIncoming: boolean;
  supportsOutgoing: boolean;
  supportsHistoricalSync: boolean;
  supportsWebhook: boolean;
  requiresManualVerification: boolean;
  disclosures: string[];
}

export interface BankProvider {
  getCapabilities(): BankProviderCapabilities;

  verifyWebhook(
    headers: Record<string, string | string[] | undefined>,
    payload: unknown,
  ): Promise<boolean>;

  parseWebhook(payload: unknown): Promise<NormalizedBankTransaction[]>;

  fetchTransactions(options: TransactionSyncOptions): Promise<BankSyncPage>;
}
