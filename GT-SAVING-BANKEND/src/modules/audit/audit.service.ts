import { Injectable } from '@nestjs/common';

@Injectable()
export class AuditService {
  async log(data: any) {
    console.log('Audit Log:', data);
    return { success: true };
  }

  async search(query: any) {
    return { data: [], total: 0 };
  }
}