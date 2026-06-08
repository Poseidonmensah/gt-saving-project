import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger('Notifications');

  async send(userId: string, message: string) {
    this.logger.log(`Notification to ${userId}: ${message}`);
    return { success: true };
  }

  async findAll() {
    return [];
  }
}