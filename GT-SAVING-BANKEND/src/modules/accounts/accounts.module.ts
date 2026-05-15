// ============================================================
// src/modules/accounts/account.entity.ts + accounts.module.ts
// ============================================================
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('accounts')
export class AccountEntity {
  @PrimaryColumn({ name: 'account_id' }) accountId: string;
  @Column({ name: 'account_number', unique: true }) accountNumber: string;
  @Column({ name: 'customer_id', nullable: true }) customerId: string;
  @Column({ name: 'product_code' }) productCode: string;
  @Column({ name: 'account_type' }) accountType: string;
  @Column({ name: 'branch_id' }) branchId: string;
  @Column({ name: 'currency', default: 'GHS' }) currency: string;
  @Column({ name: 'opening_balance', type: 'bigint', default: 0 }) openingBalance: bigint;
  @Column({ name: 'current_balance', type: 'bigint', default: 0 }) currentBalance: bigint;
  @Column({ name: 'available_balance', type: 'bigint', default: 0 }) availableBalance: bigint;
  @Column({ name: 'hold_amount', type: 'bigint', default: 0 }) holdAmount: bigint;
  @Column({ name: 'accrued_interest', type: 'bigint', default: 0 }) accruedInterest: bigint;
  @Column({ name: 'status', default: 'pending' }) status: string;
  @Column({ name: 'opened_at', type: 'date', nullable: true }) openedAt: Date;
  @Column({ name: 'last_transaction_at', nullable: true }) lastTransactionAt: Date;
  @Column({ name: 'dormancy_notified', default: false }) dormancyNotified: boolean;
  @Column({ name: 'closed_at', type: 'date', nullable: true }) closedAt: Date;
  @Column({ name: 'close_reason', nullable: true }) closeReason: string;
  @Column({ name: 'mandate_type', default: 'single' }) mandateType: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'approved_by', nullable: true }) approvedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AccountsController } from './accounts.controller';
import { AccountsService } from './accounts.service';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';

@Module({
  imports: [TypeOrmModule.forFeature([AccountEntity]), AuditModule, NotificationsModule, WorkflowModule],
  controllers: [AccountsController],
  providers: [AccountsService],
  exports: [AccountsService, TypeOrmModule],
})
export class AccountsModule {}

// ============================================================
// src/modules/accounts/accounts.service.ts
// ============================================================
import {
  Injectable, NotFoundException, ConflictException,
  BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { v4 as uuid } from 'uuid';
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

  async create(dto: CreateAccountDto, createdBy: string): Promise<AccountEntity> {
    // Check customer exists and is active
    const customer = await this.repo.manager.findOne('customers', {
      where: { customerId: dto.customerId, status: 'active' }
    });
    if (!customer) throw new BadRequestException('Customer not found or not active');

    // Check KYC status
    if ((customer as any).kycStatus !== 'approved') {
      throw new ForbiddenException('Customer KYC must be approved before opening an account');
    }

    // Check for duplicate active account of same type
    const existing = await this.repo.findOne({
      where: { customerId: dto.customerId, productCode: dto.productCode, status: 'active' }
    });
    if (existing && dto.productCode !== 'SAV001') {
      throw new ConflictException(`Customer already has an active ${dto.productCode} account`);
    }

    const accountNumber = await this.generateAccountNumber();
    const account = this.repo.create({
      accountId: uuid(),
      accountNumber,
      customerId: dto.customerId,
      productCode: dto.productCode,
      accountType: dto.accountType,
      branchId: dto.branchId,
      currency: 'GHS',
      openingBalance: dto.openingBalance ? BigInt(dto.openingBalance) : 0n,
      currentBalance: dto.openingBalance ? BigInt(dto.openingBalance) : 0n,
      availableBalance: dto.openingBalance ? BigInt(dto.openingBalance) : 0n,
      holdAmount: 0n,
      status: 'pending',
      openedAt: new Date(),
      createdBy,
    });

    const saved = await this.repo.save(account);

    // Create workflow for approval
    await this.workflow.createRequest({
      workflowType: 'account_open',
      entityType: 'account',
      entityId: saved.accountId,
      requestorId: createdBy,
      amount: dto.openingBalance,
    });

    await this.audit.log({
      actorUserId: createdBy,
      actorRole: 'teller',
      actionType: 'ACCOUNT_CREATED',
      entityType: 'account',
      entityId: saved.accountId,
      afterValue: { accountNumber: saved.accountNumber, productCode: saved.productCode },
    });

    return saved;
  }

  async activate(accountId: string, approvedBy: string) {
    const account = await this.findById(accountId);
    if (account.status !== 'pending') throw new BadRequestException('Account is not in pending state');

    await this.repo.update(accountId, { status: 'active', approvedBy, openedAt: new Date() });

    await this.audit.log({
      actorUserId: approvedBy,
      actorRole: 'admin',
      actionType: 'ACCOUNT_ACTIVATED',
      entityType: 'account',
      entityId: accountId,
      beforeValue: { status: 'pending' },
      afterValue: { status: 'active' },
    });

    return this.findById(accountId);
  }

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
      holdAmount: account.holdAmount.toString(),
      accruedInterest: account.accruedInterest.toString(),
      displayBalance: FinancialMath.format(account.currentBalance),
      displayAvailable: FinancialMath.format(account.availableBalance),
    };
  }

  async getStatement(accountId: string, fromDate: Date, toDate: Date, page = 1, limit = 50) {
    const account = await this.findById(accountId);

    const transactions = await this.repo.manager.query(
      `SELECT t.*, 
        CASE WHEN t.dest_account_id = $1 THEN t.amount ELSE NULL END as credit_amount,
        CASE WHEN t.source_account_id = $1 THEN t.amount ELSE NULL END as debit_amount
       FROM transactions t
       WHERE (t.source_account_id = $1 OR t.dest_account_id = $1)
         AND t.status = 'posted'
         AND t.business_date BETWEEN $2 AND $3
       ORDER BY t.posted_at DESC
       LIMIT $4 OFFSET $5`,
      [accountId, fromDate, toDate, limit, (page - 1) * limit]
    );

    const [{ count }] = await this.repo.manager.query(
      `SELECT COUNT(*) FROM transactions t
       WHERE (t.source_account_id = $1 OR t.dest_account_id = $1)
         AND t.status = 'posted' AND t.business_date BETWEEN $2 AND $3`,
      [accountId, fromDate, toDate]
    );

    return {
      account: { accountNumber: account.accountNumber, accountType: account.accountType },
      transactions,
      meta: { total: parseInt(count), page, limit },
    };
  }

  async freeze(accountId: string, reason: string, officerId: string) {
    const account = await this.findById(accountId);
    await this.repo.update(accountId, { status: 'frozen' });
    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'compliance_officer',
      actionType: 'ACCOUNT_FROZEN',
      entityType: 'account',
      entityId: accountId,
      beforeValue: { status: account.status },
      afterValue: { status: 'frozen' },
      reasonCode: reason,
    });
  }

  async unfreeze(accountId: string, officerId: string) {
    const account = await this.findById(accountId);
    if (account.status !== 'frozen') throw new BadRequestException('Account is not frozen');
    await this.repo.update(accountId, { status: 'active' });
    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'compliance_officer',
      actionType: 'ACCOUNT_UNFROZEN',
      entityType: 'account',
      entityId: accountId,
    });
  }

  async close(accountId: string, reason: string, officerId: string) {
    const account = await this.findById(accountId);
    if (account.status === 'closed') throw new BadRequestException('Account is already closed');
    if (account.currentBalance > 0n) {
      throw new BadRequestException('Cannot close account with positive balance. Please withdraw funds first.');
    }
    await this.repo.update(accountId, { status: 'closed', closedAt: new Date(), closeReason: reason });
    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'admin',
      actionType: 'ACCOUNT_CLOSED',
      entityType: 'account',
      entityId: accountId,
      reasonCode: reason,
    });
    return { message: 'Account closed successfully' };
  }

  /**
   * Atomically debit/credit account balance (used within DB transactions)
   */
  async debitAccount(accountId: string, amount: bigint, em: EntityManager): Promise<void> {
    const result = await em.query(
      `UPDATE accounts SET
        current_balance = current_balance - $1,
        available_balance = available_balance - $1,
        last_transaction_at = NOW()
       WHERE account_id = $2
         AND available_balance >= $1
         AND status = 'active'
       RETURNING account_id`,
      [amount.toString(), accountId]
    );
    if (result.length === 0) {
      throw new BadRequestException('Insufficient available balance or account not active');
    }
  }

  async creditAccount(accountId: string, amount: bigint, em: EntityManager): Promise<void> {
    await em.query(
      `UPDATE accounts SET
        current_balance = current_balance + $1,
        available_balance = available_balance + $1,
        last_transaction_at = NOW()
       WHERE account_id = $2`,
      [amount.toString(), accountId]
    );
  }

  async placeHold(accountId: string, amount: bigint, reason: string, placedBy: string) {
    await this.repo.query(
      `UPDATE accounts SET hold_amount = hold_amount + $1, available_balance = available_balance - $1
       WHERE account_id = $2 AND available_balance >= $1`,
      [amount.toString(), accountId]
    );
    await this.repo.manager.query(
      `INSERT INTO account_holds (hold_id, account_id, amount, reason, placed_by)
       VALUES ($1, $2, $3, $4, $5)`,
      [uuid(), accountId, amount.toString(), reason, placedBy]
    );
  }

  private async generateAccountNumber(): Promise<string> {
    const result = await this.repo.manager.query(`SELECT generate_account_number() as num`);
    return result[0].num;
  }
}

// ============================================================
// src/modules/accounts/accounts.controller.ts
// ============================================================
import {
  Controller, Get, Post, Body, Param, Query,
  UseGuards, Patch, Delete,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';
import { IsString, IsOptional, IsIn, IsNumber, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class CreateAccountDto {
  @IsString() customerId: string;
  @IsString() productCode: string;
  @IsIn(['savings','current','salary','fixed_deposit']) accountType: string;
  @IsString() branchId: string;
  @IsOptional() @IsNumber() openingBalance?: number;
}

@ApiTags('accounts')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('accounts')
export class AccountsController {
  constructor(private accountsService: AccountsService) {}

  @Post()
  @Roles('super_admin','admin','branch_manager','teller')
  create(@Body() dto: CreateAccountDto, @CurrentUser('userId') userId: string) {
    return this.accountsService.create(dto, userId);
  }

  @Get(':accountId')
  findOne(@Param('accountId') accountId: string) {
    return this.accountsService.findById(accountId);
  }

  @Get('by-number/:accountNumber')
  findByNumber(@Param('accountNumber') accountNumber: string) {
    return this.accountsService.findByNumber(accountNumber);
  }

  @Get(':accountId/balance')
  getBalance(@Param('accountId') accountId: string) {
    return this.accountsService.getBalance(accountId);
  }

  @Get(':accountId/statement')
  getStatement(
    @Param('accountId') accountId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('page') @Type(() => Number) page = 1,
    @Query('limit') @Type(() => Number) limit = 50,
  ) {
    return this.accountsService.getStatement(accountId, new Date(fromDate), new Date(toDate), page, limit);
  }

  @Post(':accountId/activate')
  @Roles('super_admin','admin','branch_manager')
  activate(@Param('accountId') accountId: string, @CurrentUser('userId') userId: string) {
    return this.accountsService.activate(accountId, userId);
  }

  @Post(':accountId/freeze')
  @Roles('super_admin','admin','compliance_officer','branch_manager')
  freeze(
    @Param('accountId') accountId: string,
    @Body('reason') reason: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.accountsService.freeze(accountId, reason, userId);
  }

  @Post(':accountId/unfreeze')
  @Roles('super_admin','admin','compliance_officer','branch_manager')
  unfreeze(@Param('accountId') accountId: string, @CurrentUser('userId') userId: string) {
    return this.accountsService.unfreeze(accountId, userId);
  }

  @Post(':accountId/close')
  @Roles('super_admin','admin','branch_manager')
  close(
    @Param('accountId') accountId: string,
    @Body('reason') reason: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.accountsService.close(accountId, reason, userId);
  }
}
