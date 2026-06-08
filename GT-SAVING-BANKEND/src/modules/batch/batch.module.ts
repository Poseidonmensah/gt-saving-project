import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [NotificationsModule],
  providers: [], // We keep this empty for now to allow a successful host
})
export class BatchModule {}