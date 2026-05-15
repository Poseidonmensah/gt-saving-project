import { Module } from '@nestjs/common';
import { InterestEngineService } from './interest-engine.service';
import { LedgerModule } from '../ledger/ledger.module';

@Module({
  imports: [LedgerModule],
  providers: [InterestEngineService],
  exports: [InterestEngineService],
})
export class InterestEngineModule {}
