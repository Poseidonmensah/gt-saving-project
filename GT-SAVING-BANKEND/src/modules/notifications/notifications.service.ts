import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  async sendEmail(to: string, subject: string, body: string) {
    this.logger.log(`📧 Email sent to ${to}: ${subject}`);
    return { success: true };
  }

  async sendSms(to: string, message: string) {
    this.logger.log(`📱 SMS sent to ${to}: ${message}`);
    return { success: true };
  }

  async findAll() {
    return [];
  }
}