import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  async log(data: any) {
    // This logs to the console so you can see it in Back4App logs
    console.log('AUDIT_LOG:', JSON.stringify(data));
    return { success: true };
  }

  async search(query: any) {
    return { data: [], total: 0 };
  }
}