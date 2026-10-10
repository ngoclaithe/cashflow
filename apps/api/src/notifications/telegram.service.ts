import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly config: ConfigService) {}

  async sendMessage(text: string): Promise<boolean> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      this.logger.log(`Telegram not configured. Logged notification:\n${text}`);
      return false;
    }

    try {
      const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
      await axios.post(
        url,
        {
          chat_id: chatId,
          text,
          parse_mode: 'HTML',
        },
        { timeout: 8000 },
      );
      return true;
    } catch (error: any) {
      this.logger.error(`Failed to send Telegram notification: ${error.message}`);
      return false;
    }
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    const botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_CHAT_ID');

    if (!botToken || !chatId) {
      return {
        success: false,
        message: 'Telegram Bot Token hoặc Chat ID chưa được cấu hình trong .env',
      };
    }

    try {
      const success = await this.sendMessage(
        '🚀 <b>Cashflow - Thông báo thử nghiệm</b>\n\nKết nối Telegram Bot hoạt động bình thường!',
      );
      return {
        success,
        message: success ? 'Gửi tin nhắn Telegram thành công!' : 'Không thể gửi tin nhắn Telegram',
      };
    } catch (e: any) {
      return { success: false, message: e.message };
    }
  }
}
