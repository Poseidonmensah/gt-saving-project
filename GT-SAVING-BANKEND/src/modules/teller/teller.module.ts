import { Module } from '@nestjs/common';
import { TellerController } from './teller.controller';
import { TellerService } from './teller.service';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [AuditModule],
  controllers: [TellerController],
  providers: [TellerService],
  exports: [TellerService],
})
export class TellerModule {}
