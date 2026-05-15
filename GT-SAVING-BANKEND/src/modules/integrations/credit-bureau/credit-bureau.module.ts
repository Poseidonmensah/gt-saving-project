import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { CreditBureauService } from './credit-bureau.service';

@Module({
  imports: [HttpModule],
  providers: [CreditBureauService],
  exports: [CreditBureauService],
})
export class CreditBureauModule {}
