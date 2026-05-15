import { Module } from '@nestjs/common';
import { EndOfDayService } from './end-of-day.service';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ReconciliationModule } from '../reconciliation/reconciliation.module';

@Module({
  imports: [LedgerModule, AuditModule, NotificationsModule, ReconciliationModule],
  providers: [EndOfDayService],
  exports: [EndOfDayService],
})
export class BatchModule {}
