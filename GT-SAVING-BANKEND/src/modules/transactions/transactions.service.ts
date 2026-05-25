import { Injectable } from '@nestjs/common';
import { AccountsService } from '../accounts/accounts.service';

@Injectable()
export class TransactionsService {
  constructor(private readonly accountsService: AccountsService) {}

  async findAll() {
    return { data: [], total: 0 };
  }

  async findOne(id: string) {
    return { id, status: 'completed', amount: 0 };
  }

  async deposit(dto: any) {
    return { message: 'Deposit successful' };
  }
}