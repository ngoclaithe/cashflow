import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';

@Controller('dashboard')
@UseGuards(JwtAuthGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  async getSummary(@CurrentUser() user: UserPayload) {
    return this.dashboardService.getSummary(user.userId);
  }

  @Get('cash-flow')
  async getCashFlow(
    @CurrentUser() user: UserPayload,
    @Query('months') months?: string,
  ) {
    const m = months ? Number(months) : 6;
    return this.dashboardService.getCashFlowHistory(user.userId, m);
  }

  @Get('category-breakdown')
  async getCategoryBreakdown(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    return this.dashboardService.getCategoryBreakdown(
      user.userId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
