import { Module } from '@nestjs/common';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountsModule } from '../accounts/accounts.module';

@Module({
  imports: [AccountsModule], // This gives Transactions access to AccountsService
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService],
})
export class TransactionsModule {}