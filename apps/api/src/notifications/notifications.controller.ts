import { Controller, Post, UseGuards } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('integrations/telegram')
export class NotificationsController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('test')
  @UseGuards(JwtAuthGuard)
  async testTelegram() {
    return this.telegramService.testConnection();
  }
}
