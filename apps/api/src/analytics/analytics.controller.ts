import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService, AnalyzeOptions } from './analytics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../common/current-user.decorator';

@Controller('analytics')
@UseGuards(JwtAuthGuard)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  /**
   * Return initial config (defaults, accounts, and suggested upcoming milestone items)
   * without calling the Gemini AI API.
   */
  @Get('config')
  async getConfig(@CurrentUser() user: UserPayload) {
    return this.analyticsService.getInitialConfig(user.userId);
  }

  /**
   * Run custom analysis with user's selected parameters, dates, upcoming items, and question.
   */
  @Post('analyze')
  async analyze(
    @CurrentUser() user: UserPayload,
    @Body() options: AnalyzeOptions,
  ) {
    return this.analyticsService.analyze(user.userId, options);
  }

  /**
   * Convenience GET endpoint for initial or fast forecast.
   */
  @Get('forecast')
  async getForecast(
    @CurrentUser() user: UserPayload,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('targetDate') targetDate?: string,
  ) {
    return this.analyticsService.analyze(user.userId, {
      startDate,
      endDate,
      targetDate,
    });
  }
}
