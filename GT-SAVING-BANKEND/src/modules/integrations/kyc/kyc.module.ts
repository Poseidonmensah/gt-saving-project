import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { KycService } from './kyc.service';

@Module({
  imports: [HttpModule],
  providers: [KycService],
  exports: [KycService],
})
export class KycModule {}
