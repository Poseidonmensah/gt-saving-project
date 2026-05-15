import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerModule } from '@nestjs/throttler';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { BullModule } from '@nestjs/bull';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { TellerModule } from './modules/teller/teller.module';
import { LoansModule } from './modules/loans/loans.module';
import { FixedDepositsModule } from './modules/fixed-deposits/fixed-deposits.module';
import { InterestEngineModule } from './modules/interest-engine/interest-engine.module';
import { FeesModule } from './modules/fees/fees.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ReconciliationModule } from './modules/reconciliation/reconciliation.module';
import { WorkflowModule } from './modules/workflow/workflow.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { AuditModule } from './modules/audit/audit.module';
import { ReportsModule } from './modules/reports/reports.module';
import { BatchModule } from './modules/batch/batch.module';
import { MobileMoneyModule } from './modules/integrations/mobile-money/mobile-money.module';
import { BankModule } from './modules/integrations/bank/bank.module';
import { KycModule } from './modules/integrations/kyc/kyc.module';
import { CreditBureauModule } from './modules/integrations/credit-bureau/credit-bureau.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host:     cfg.get('DB_HOST', 'localhost'),
        port:     cfg.get<number>('DB_PORT', 5432),
        database: cfg.get('DB_NAME', 'goodtime_sls'),
        username: cfg.get('DB_USER', 'gtsl_app'),
        password: cfg.get('DB_PASSWORD'),
        ssl:      cfg.get('DB_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        entities: [__dirname + '/**/*.entity{.ts,.js}', __dirname + '/**/*.module{.ts,.js}'],
        synchronize: false,
        logging: cfg.get('NODE_ENV') === 'development' ? ['error'] : ['error'],
        pool: { max: cfg.get<number>('DB_POOL_MAX', 20), min: cfg.get<number>('DB_POOL_MIN', 5) },
      }),
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ([{
        ttl: cfg.get<number>('RATE_LIMIT_TTL', 60000),
        limit: cfg.get<number>('RATE_LIMIT_MAX', 100),
      }]),
    }),
    EventEmitterModule.forRoot({ wildcard: true, delimiter: '.' }),
    ScheduleModule.forRoot(),
    BullModule.forRootAsync({
      imports: [ConfigModule], inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        redis: {
          host: cfg.get('REDIS_HOST', 'localhost'),
          port: cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get('REDIS_PASSWORD') || undefined,
        },
      }),
    }),
    // Core
    AuditModule, NotificationsModule, LedgerModule, WorkflowModule, FeesModule,
    // Business
    AuthModule, UsersModule, CustomersModule, AccountsModule,
    TransactionsModule, TellerModule, LoansModule, FixedDepositsModule,
    InterestEngineModule, ReconciliationModule, DocumentsModule,
    ConfigurationModule, ReportsModule, BatchModule,
    // Integrations
    MobileMoneyModule, BankModule, KycModule, CreditBureauModule,
  ],
})
export class AppModule {}
