import { Injectable, NotFoundException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AccountEntity } from './entities/account.entity';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { FinancialMath } from '../../common/utils/financial.util';

@Injectable()
export class AccountsService {
  constructor(
    @InjectRepository(AccountEntity) private repo: Repository<AccountEntity>,
    private audit: AuditService,
    private notifications: NotificationsService,
    private workflow: WorkflowService,
  ) {}

  async findById(accountId: string): Promise<AccountEntity> {
    const account = await this.repo.findOne({ where: { accountId } });
    if (!account) throw new NotFoundException('Account not found');
    return account;
  }

  async findByNumber(accountNumber: string): Promise<AccountEntity> {
    const account = await this.repo.findOne({ where: { accountNumber } });
    if (!account) throw new NotFoundException(`Account ${accountNumber} not found`);
    return account;
  }

  async getBalance(accountId: string) {
    const account = await this.findById(accountId);
    return {
      accountId: account.accountId,
      accountNumber: account.accountNumber,
      currentBalance: account.currentBalance.toString(),
      availableBalance: account.availableBalance.toString(),
    };
  }

  async activate(accountId: string, approvedBy: string) {
    await this.repo.update(accountId, { status: 'active', approvedBy, openedAt: new Date() });
    return this.findById(accountId);
  }

  async freeze(accountId: string, reason: string, officerId: string) {
    await this.repo.update(accountId, { status: 'frozen' });
  }

  async unfreeze(accountId: string, officerId: string) {
    await this.repo.update(accountId, { status: 'active' });
  }

  async close(accountId: string, reason: string, officerId: string) {
    await this.repo.update(accountId, { status: 'closed', closedAt: new Date(), closeReason: reason });
  }

  async create(dto: any, createdBy: string) {
    // Basic logic
    return { message: 'created' };
  }

  async getStatement(accountId: string, from: Date, to: Date, page: number, limit: number) {
    return { data: [] };
  }
}