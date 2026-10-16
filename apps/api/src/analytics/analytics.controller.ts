import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('forecast')
  async getForecast(
    @CurrentUser() user: UserPayload,
    @Query('refresh') refresh?: string,
  ) {
    const isRefresh = refresh === 'true' || refresh === '1';
    return this.analyticsService.getCashflowForecast(user.userId, isRefresh);
  }

  @Post('reanalyze')
  async reanalyze(@CurrentUser() user: UserPayload) {
    return this.analyticsService.getCashflowForecast(user.userId, true);
  }
}
