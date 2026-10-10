import { Module } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { ReconciliationController } from './reconciliation.controller';
import { BankIntegrationsModule } from '../bank-integrations/bank-integrations.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [BankIntegrationsModule, NotificationsModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService],
})
export class ReconciliationModule {}
