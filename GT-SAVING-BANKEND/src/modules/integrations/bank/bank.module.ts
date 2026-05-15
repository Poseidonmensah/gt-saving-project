import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { BankService } from './bank.service';

@Module({
  imports: [HttpModule],
  providers: [BankService],
  exports: [BankService],
})
export class BankModule {}
