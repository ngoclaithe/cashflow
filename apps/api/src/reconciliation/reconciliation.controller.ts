import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('reconciliation')
@UseGuards(JwtAuthGuard)
export class ReconciliationController {
  constructor(private readonly reconciliationService: ReconciliationService) {}

  @Get('status')
  async getStatus() {
    return this.reconciliationService.getLatestStatus();
  }

  @Get('history')
  async getHistory() {
    return this.reconciliationService.getHistory();
  }

  @Post('run')
  async runManualReconciliation(@Body() body: { lookbackDays?: number }) {
    return this.reconciliationService.runReconciliation(body.lookbackDays || 2);
  }
}
