import { Module } from '@nestjs/common';
import { CategorizationRulesService } from './categorization-rules.service';
import { CategorizationRulesController } from './categorization-rules.controller';

@Module({
  controllers: [CategorizationRulesController],
  providers: [CategorizationRulesService],
  exports: [CategorizationRulesService],
})
export class CategorizationRulesModule {}
