import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { v4 as uuid } from 'uuid';
import { firstValueFrom, catchError, of } from 'rxjs';
import { NotificationEntity } from './notifications.module';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(NotificationEntity) private readonly repo: Repository<NotificationEntity>,
    private readonly config: ConfigService,
    private readonly http: HttpService,
  ) {}

  async sendSms(phoneNumber: string, message: string, entityType?: string, entityId?: string): Promise<void> {
    const saved = await this.repo.save(this.repo.create({
      notificationId: uuid(), channel: 'sms', recipientAddress: phoneNumber,
      templateCode: 'CUSTOM', body: message, status: 'queued',
      relatedEntityType: entityType, relatedEntityId: entityId,
    }));
    try {
      const clientId     = this.config.get('SMS_CLIENT_ID');
      const clientSecret = this.config.get('SMS_CLIENT_SECRET');
      const senderId     = this.config.get('SMS_SENDER_ID', 'GoodTime');
      if (!clientId) {
        this.logger.warn(`SMS not configured — skipping send to ${phoneNumber}`);
        await this.repo.update(saved.notificationId, { status: 'sent', sentAt: new Date() });
        return;
      }
      const formatted = phoneNumber.startsWith('+233') ? phoneNumber : `+233${phoneNumber.replace(/^0/, '')}`;
      await firstValueFrom(
        this.http.get('https://smsc.hubtel.com/v1/messages/send', {
          params: { clientsecret: clientSecret, clientid: clientId, from: senderId, to: formatted, content: message },
        }).pipe(catchError(err => { throw err; }))
      );
      await this.repo.update(saved.notificationId, { status: 'sent', sentAt: new Date() });
    } catch (err) {
      this.logger.error(`SMS failed to ${phoneNumber}: ${err.message}`);
      await this.repo.update(saved.notificationId, { status: 'failed', failedReason: err.message });
    }
  }

  async sendEmail(to: string, subject: string, body: string): Promise<void> {
    await this.repo.save(this.repo.create({
      notificationId: uuid(), channel: 'email', recipientAddress: to,
      templateCode: 'CUSTOM', subject, body, status: 'queued',
    }));
    this.logger.log(`Email queued → ${to}: ${subject}`);
  }

  async getForCustomer(customerId: string, page = 1, limit = 20) {
    const [data, total] = await this.repo.findAndCount({
      where: { recipientCustomerId: customerId },
      order: { createdAt: 'DESC' },
      skip: (page - 1) * limit, take: limit,
    });
    return { data, meta: { total, page, limit } };
  }
}
