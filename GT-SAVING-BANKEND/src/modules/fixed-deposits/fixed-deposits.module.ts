import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FixedDepositsController } from './fixed-deposits.controller';
import { FixedDepositsService } from './fixed-deposits.service';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { FixedDepositEntity } from './fixed-deposits.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([FixedDepositEntity]),
    AccountsModule, LedgerModule, AuditModule, NotificationsModule, WorkflowModule,
  ],
  controllers: [FixedDepositsController],
  providers: [FixedDepositsService],
  exports: [FixedDepositsService, TypeOrmModule],
})
export class FixedDepositsModule {}
