import { Injectable } from '@nestjs/common';

@Injectable()
export class FixedDepositsService {
  async search(query: any) {
    return { data: [], meta: { total: 0, page: 1, limit: 25 } };
  }

  async place(dto: any, userId: string) {
    return { message: 'FD Placed' };
  }
}