import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AccountsModule } from './accounts/accounts.module';
import { CategoriesModule } from './categories/categories.module';
import { CategorizationRulesModule } from './categorization-rules/categorization-rules.module';
import { TransactionsModule } from './transactions/transactions.module';
import { BankIntegrationsModule } from './bank-integrations/bank-integrations.module';
import { BudgetsModule } from './budgets/budgets.module';
import { RecurringTransactionsModule } from './recurring-transactions/recurring-transactions.module';
import { SavingsGoalsModule } from './savings-goals/savings-goals.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReconciliationModule } from './reconciliation/reconciliation.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', 'apps/api/.env'],
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    AccountsModule,
    CategoriesModule,
    CategorizationRulesModule,
    TransactionsModule,
    BankIntegrationsModule,
    BudgetsModule,
    RecurringTransactionsModule,
    SavingsGoalsModule,
    NotificationsModule,
    ReconciliationModule,
    DashboardModule,
    HealthModule,
  ],
})
export class AppModule {}
