import { Module } from '@nestjs/common';
import { SepayProvider } from './sepay/sepay.provider';
import { SynchronizationService } from './synchronization/synchronization.service';
import { IntegrationsController } from './integrations.controller';
import { CategorizationRulesModule } from '../categorization-rules/categorization-rules.module';

@Module({
  imports: [CategorizationRulesModule],
  controllers: [IntegrationsController],
  providers: [SepayProvider, SynchronizationService],
  exports: [SepayProvider, SynchronizationService],
})
export class BankIntegrationsModule {}
