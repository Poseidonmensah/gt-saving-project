import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger('Workflow');

  async createRequest(data: any) {
    this.logger.log(`Workflow request created: ${JSON.stringify(data)}`);
    return { success: true, requestId: 'wf_123' };
  }

  async findAll() {
    return [];
  }
}