import { Module, Global } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';

@Global() // Make it Global so Accounts and Loans can use it easily
@Module({
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService], // CRITICAL: This allows other modules to use WorkflowService
})
export class WorkflowModule {}