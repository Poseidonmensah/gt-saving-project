import { Injectable } from '@nestjs/common';

@Injectable()
export class FixedDepositsService {
  async search(query: any) {
    return { data: [], meta: { total: 0, page: 1, limit: 25 } };
  }

  async findById(id: string) {
    return { id, status: 'active', amount: 0 };
  }

  async place(dto: any, userId: string) {
    return { message: 'Fixed Deposit placed' };
  }

  async earlyLiquidation(id: string, reason: string, userId: string) {
    return { message: 'Liquidation requested' };
  }

  async executeEarlyLiquidation(id: string, userId: string) {
    return { message: 'Liquidation executed' };
  }
}