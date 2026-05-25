import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class LoansService {
  async search(query: any) {
    return { data: [], meta: { total: 0, page: 1, limit: 10 } };
  }

  async findById(id: string) {
    return { id, status: 'active', amount: 0 };
  }

  async create(dto: any, userId: string) {
    return { message: 'Loan application submitted successfully' };
  }

  async approve(id: string, userId: string) {
    return { message: 'Loan approved' };
  }
}