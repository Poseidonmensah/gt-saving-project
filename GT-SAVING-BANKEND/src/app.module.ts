import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TellerModule } from './modules/teller/teller.module';
import { LoansModule } from './modules/loans/loans.module';
import { FixedDepositsModule } from './modules/fixed-deposits/fixed-deposits.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        // CRITICAL: This uses the Koyeb connection string you added to Back4App
        url: cfg.get('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: { rejectUnauthorized: false }, 
      }),
    }),
    ThrottlerModule.forRoot([{
      ttl: 60000,
      limit: 100,
    }]),
    EventEmitterModule.forRoot({ wildcard: true }),
    ScheduleModule.forRoot(),
    // Core & Business Modules
    AuditModule, NotificationsModule, LedgerModule, WorkflowModule,
    AuthModule, UsersModule, CustomersModule, AccountsModule,
    TransactionsModule, TellerModule, LoansModule, FixedDepositsModule,
    ReconciliationModule, DocumentsModule, ConfigurationModule, ReportsModule,
  ],
})
export class AppModule {}