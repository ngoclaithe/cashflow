import { Module } from '@nestjs/common';
import { GpmpayProvider } from './gpmpay/gpmpay.provider';
import { SynchronizationService } from './synchronization/synchronization.service';
import { IntegrationsController } from './integrations.controller';
import { CategorizationRulesModule } from '../categorization-rules/categorization-rules.module';

@Module({
  imports: [CategorizationRulesModule],
  controllers: [IntegrationsController],
  providers: [GpmpayProvider, SynchronizationService],
  exports: [GpmpayProvider, SynchronizationService],
})
export class BankIntegrationsModule {}
