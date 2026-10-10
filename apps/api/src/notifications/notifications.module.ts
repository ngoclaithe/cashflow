import { Module } from '@nestjs/common';
import { TelegramService } from './telegram.service';
import { NotificationsController } from './notifications.controller';

@Module({
  controllers: [NotificationsController],
  providers: [TelegramService],
  exports: [TelegramService],
})
export class NotificationsModule {}
