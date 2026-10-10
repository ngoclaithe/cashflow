import { Module } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';
import { BudgetsModule } from '../budgets/budgets.module';
import { RecurringTransactionsModule } from '../recurring-transactions/recurring-transactions.module';
import { SavingsGoalsModule } from '../savings-goals/savings-goals.module';

@Module({
  imports: [BudgetsModule, RecurringTransactionsModule, SavingsGoalsModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
