import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CustomersModule } from './modules/customers/customers.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { TransactionsModule } from './modules/transactions/transactions.module';
import { AuditModule } from './modules/audit/audit.module';

const importsArray = [
  ConfigModule.forRoot({ isGlobal: true }),
  // Only register TypeOrmModule if DATABASE_URL is present; this prevents
  // startup from crashing in environments where the DB is unavailable.
  ...(process.env.DATABASE_URL
    ? [
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            type: 'postgres',
            url: config.get('DATABASE_URL'),
            autoLoadEntities: true,
            synchronize: false,
            retryAttempts: 1, // Fail fast so health check doesn't time out
            ssl: { rejectUnauthorized: false },
          }),
        }),
      ]
    : []),
  AuthModule,
  UsersModule,
  CustomersModule,
  AccountsModule,
  TransactionsModule,
  AuditModule,
];

@Module({
  imports: importsArray,
})
export class AppModule {}