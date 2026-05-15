import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryColumn({ name: 'notification_id' }) notificationId: string;
  @Column({ name: 'recipient_user_id', nullable: true }) recipientUserId: string;
  @Column({ name: 'recipient_customer_id', nullable: true }) recipientCustomerId: string;
  @Column({ name: 'channel' }) channel: string;
  @Column({ name: 'recipient_address' }) recipientAddress: string;
  @Column({ name: 'template_code' }) templateCode: string;
  @Column({ name: 'subject', nullable: true }) subject: string;
  @Column({ name: 'body' }) body: string;
  @Column({ name: 'status', default: 'queued' }) status: string;
  @Column({ name: 'provider_ref', nullable: true }) providerRef: string;
  @Column({ name: 'retry_count', default: 0 }) retryCount: number;
  @Column({ name: 'sent_at', nullable: true }) sentAt: Date;
  @Column({ name: 'delivered_at', nullable: true }) deliveredAt: Date;
  @Column({ name: 'failed_reason', nullable: true }) failedReason: string;
  @Column({ name: 'related_entity_type', nullable: true }) relatedEntityType: string;
  @Column({ name: 'related_entity_id', nullable: true }) relatedEntityId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Module({
  imports: [TypeOrmModule.forFeature([NotificationEntity]), HttpModule],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService, TypeOrmModule],
})
export class NotificationsModule {}
