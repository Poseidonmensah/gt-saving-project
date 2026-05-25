// ============================================================
// src/modules/transactions/transaction.entity.ts
// ============================================================
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('transactions')
export class TransactionEntity {
  @PrimaryColumn({ name: 'transaction_id' }) transactionId: string;
  @Column({ name: 'transaction_ref', unique: true }) transactionRef: string;
  @Column({ name: 'idempotency_key', unique: true, nullable: true }) idempotencyKey: string;
  @Column({ name: 'transaction_type' }) transactionType: string;
  @Column({ name: 'channel' }) channel: string;
  @Column({ name: 'source_account_id', nullable: true }) sourceAccountId: string;
  @Column({ name: 'dest_account_id', nullable: true }) destAccountId: string;
  @Column({ name: 'amount', type: 'bigint' }) amount: bigint;
  @Column({ name: 'fees', type: 'bigint', default: 0 }) fees: bigint;
  @Column({ name: 'penalties', type: 'bigint', default: 0 }) penalties: bigint;
  @Column({ name: 'net_amount', type: 'bigint' }) netAmount: bigint;
  @Column({ name: 'currency', default: 'GHS' }) currency: string;
  @Column({ name: 'narration', nullable: true }) narration: string;
  @Column({ name: 'status', default: 'pending' }) status: string;
  @Column({ name: 'business_date', type: 'date' }) businessDate: Date;
  @Column({ name: 'initiated_by' }) initiatedBy: string;
  @Column({ name: 'approved_by', nullable: true }) approvedBy: string;
  @Column({ name: 'approved_at', nullable: true }) approvedAt: Date;
  @Column({ name: 'posted_at', nullable: true }) postedAt: Date;
  @Column({ name: 'reversal_of', nullable: true }) reversalOf: string;
  @Column({ name: 'reversed_by', nullable: true }) reversedBy: string;
  @Column({ name: 'provider_ref', nullable: true }) providerRef: string;
  @Column({ name: 'external_ref', nullable: true }) externalRef: string;
  @Column({ name: 'branch_id' }) branchId: string;
  @Column({ name: 'drawer_id', nullable: true }) drawerId: string;
  @Column({ name: 'customer_name_provided', nullable: true }) customerNameProvided: string;
  @Column({ name: 'name_match_confirmed', nullable: true }) nameMatchConfirmed: boolean;
  @Column({ name: 'metadata', type: 'jsonb', nullable: true }) metadata: any;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

// ============================================================
// src/modules/transactions/transactions.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TransactionsController } from './transactions.controller';
import { TransactionsService } from './transactions.service';
import { AccountsModule } from '../accounts/accounts.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { FeesModule } from '../fees/fees.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([TransactionEntity]),
    AccountsModule, LedgerModule, AuditModule, NotificationsModule, WorkflowModule, FeesModule,
  ],
  controllers: [TransactionsController],
  providers: [TransactionsService],
  exports: [TransactionsService, TypeOrmModule],
})
export class TransactionsModule {}

// ============================================================
// src/modules/transactions/transactions.service.ts
// THE CORE TRANSACTION ENGINE
// ============================================================
import {
  Injectable, BadRequestException, ConflictException,
  NotFoundException, Logger, ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AccountsService } from '../accounts/accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { FeesService } from '../fees/fees.service';
import { WorkflowService } from '../workflow/workflow.service';
import { FinancialMath, generateRef } from '../../common/utils/financial.util';

@Injectable()
export class TransactionsService {
  private readonly logger = new Logger(TransactionsService.name);

  constructor(
    @InjectRepository(TransactionEntity) private repo: Repository<TransactionEntity>,
    private dataSource: DataSource,
    private accountsService: AccountsService,
    private ledgerService: LedgerService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private feesService: FeesService,
    private workflow: WorkflowService,
  ) {}

  /**
   * TELLER DEPOSIT — with mandatory name verification
   */
  async tellerDeposit(dto: TellerDepositDto, tellerId: string, branchId: string): Promise<TransactionEntity> {
    // 1. Idempotency check
    if (dto.idempotencyKey) {
      const existing = await this.repo.findOne({ where: { idempotencyKey: dto.idempotencyKey } });
      if (existing) {
        this.logger.warn(`Duplicate idempotency key: ${dto.idempotencyKey}`);
        return existing;
      }
    }

    // 2. Find destination account
    const account = await this.accountsService.findByNumber(dto.accountNumber);

    // 3. MANDATORY name verification (SRS 6.2.2-6.2.4)
    const nameMatch = this.verifyNameMatch(dto.customerName, account);
    if (!nameMatch.matched) {
      // Log exception and reject
      await this.audit.log({
        actorUserId: tellerId,
        actorRole: 'teller',
        actionType: 'NAME_MISMATCH_EXCEPTION',
        entityType: 'account',
        entityId: account.accountId,
        description: `Name mismatch: provided="${dto.customerName}", system="${nameMatch.systemName}"`,
      });
      throw new BadRequestException(
        `Name mismatch! Provided: "${dto.customerName}" does not match account holder. Transaction rejected.`
      );
    }

    // 4. Account must accept deposits
    if (!['active'].includes(account.status)) {
      throw new ForbiddenException(`Account ${dto.accountNumber} is ${account.status} and cannot receive deposits`);
    }

    // 5. Get teller drawer
    const drawer = await this.getTellerDrawer(tellerId, branchId);

    // 6. Calculate fees
    const fee = await this.feesService.calculateFee('DEPOSIT', dto.productCode || account.productCode, dto.amount);

    const amount = BigInt(dto.amount);
    const feeAmount = BigInt(fee);
    const netCredit = amount - feeAmount;

    // 7. Execute in DB transaction
    return await this.dataSource.transaction(async (em) => {
      // Credit customer account
      await this.accountsService.creditAccount(account.accountId, netCredit, em);

      // Credit teller drawer (cash in)
      await em.query(
        `UPDATE teller_drawers SET closing_balance = COALESCE(closing_balance, opening_balance) + $1 WHERE drawer_id = $2`,
        [amount.toString(), drawer?.drawerId]
      );

      // Create transaction record
      const txn = em.create(TransactionEntity, {
        transactionId: uuid(),
        transactionRef: generateRef('DEP'),
        idempotencyKey: dto.idempotencyKey,
        transactionType: 'deposit',
        channel: 'teller',
        destAccountId: account.accountId,
        amount,
        fees: feeAmount,
        penalties: 0n,
        netAmount: netCredit,
        currency: 'GHS',
        narration: dto.narration || `Cash deposit by teller`,
        status: 'posted',
        businessDate: new Date(),
        initiatedBy: tellerId,
        approvedBy: tellerId,
        approvedAt: new Date(),
        postedAt: new Date(),
        branchId,
        drawerId: drawer?.drawerId,
        customerNameProvided: dto.customerName,
        nameMatchConfirmed: true,
        metadata: { drawerRef: dto.drawerRef },
      });
      const savedTxn = await em.save(TransactionEntity, txn);

      // Post to general ledger (double-entry)
      await this.ledgerService.postDepositJournal(em, {
        transactionId: savedTxn.transactionId,
        amount,
        feeAmount,
        accountProductCode: account.productCode,
        branchId,
        narration: `Teller deposit - ${savedTxn.transactionRef}`,
      });

      return savedTxn;
    });
  }

  /**
   * TELLER WITHDRAWAL
   */
  async tellerWithdrawal(dto: TellerWithdrawalDto, tellerId: string, branchId: string): Promise<any> {
    const account = await this.accountsService.findByNumber(dto.accountNumber);

    // Status checks
    if (!['active'].includes(account.status)) {
      throw new ForbiddenException(`Account is ${account.status}`);
    }

    // Name verification
    const nameMatch = this.verifyNameMatch(dto.customerName, account);
    if (!nameMatch.matched) {
      throw new BadRequestException(`Identity verification failed. Name does not match records.`);
    }

    const amount = BigInt(dto.amount);
    const fee = await this.feesService.calculateFee('WITHDRAW', account.productCode, dto.amount);
    const feeAmount = BigInt(fee);
    const totalDebit = amount + feeAmount;

    // Balance check
    if (account.availableBalance < totalDebit) {
      throw new BadRequestException(
        `Insufficient balance. Available: ${FinancialMath.format(account.availableBalance)}, Required: ${FinancialMath.format(totalDebit)}`
      );
    }

    // Approval check for high-value (SRS 6.3.3)
    const thresholds = await this.getWithdrawalThresholds();
    const requiresApproval = amount >= BigInt(thresholds.supervisorThreshold);

    if (requiresApproval) {
      // Create workflow request
      const workflowReq = await this.workflow.createRequest({
        workflowType: 'withdrawal',
        entityType: 'account',
        entityId: account.accountId,
        requestorId: tellerId,
        amount: Number(amount),
        notes: dto.narration,
        metadata: { dto, branchId },
      });
      return {
        status: 'pending_approval',
        workflowRequestId: workflowReq.requestId,
        message: `Withdrawal of ${FinancialMath.format(amount)} requires supervisor approval.`,
      };
    }

    return await this.executeWithdrawal(account, amount, feeAmount, dto, tellerId, branchId);
  }

  async executeWithdrawal(account: any, amount: bigint, feeAmount: bigint, dto: any, tellerId: string, branchId: string) {
    const totalDebit = amount + feeAmount;
    const drawer = await this.getTellerDrawer(tellerId, branchId);

    return await this.dataSource.transaction(async (em) => {
      await this.accountsService.debitAccount(account.accountId, totalDebit, em);

      await em.query(
        `UPDATE teller_drawers SET closing_balance = COALESCE(closing_balance, opening_balance) - $1 WHERE drawer_id = $2`,
        [amount.toString(), drawer?.drawerId]
      );

      const txn = em.create(TransactionEntity, {
        transactionId: uuid(),
        transactionRef: generateRef('WDR'),
        idempotencyKey: dto.idempotencyKey,
        transactionType: 'withdrawal',
        channel: 'teller',
        sourceAccountId: account.accountId,
        amount,
        fees: feeAmount,
        penalties: 0n,
        netAmount: amount,
        currency: 'GHS',
        narration: dto.narration || 'Cash withdrawal',
        status: 'posted',
        businessDate: new Date(),
        initiatedBy: tellerId,
        approvedBy: tellerId,
        approvedAt: new Date(),
        postedAt: new Date(),
        branchId,
        drawerId: drawer?.drawerId,
        customerNameProvided: dto.customerName,
        nameMatchConfirmed: true,
      });
      const savedTxn = await em.save(TransactionEntity, txn);

      await this.ledgerService.postWithdrawalJournal(em, {
        transactionId: savedTxn.transactionId,
        amount,
        feeAmount,
        accountProductCode: account.productCode,
        branchId,
        narration: `Teller withdrawal - ${savedTxn.transactionRef}`,
      });

      return savedTxn;
    });
  }

  /**
   * INTERNAL TRANSFER
   */
  async internalTransfer(dto: TransferDto, initiatedBy: string, branchId: string) {
    if (dto.sourceAccountNumber === dto.destAccountNumber) {
      throw new BadRequestException('Source and destination accounts cannot be the same');
    }

    const sourceAccount = await this.accountsService.findByNumber(dto.sourceAccountNumber);
    const destAccount = await this.accountsService.findByNumber(dto.destAccountNumber);

    if (sourceAccount.status !== 'active') throw new ForbiddenException('Source account is not active');
    if (destAccount.status !== 'active') throw new ForbiddenException('Destination account is not active');

    const amount = BigInt(dto.amount);
    if (sourceAccount.availableBalance < amount) {
      throw new BadRequestException('Insufficient balance');
    }

    return await this.dataSource.transaction(async (em) => {
      await this.accountsService.debitAccount(sourceAccount.accountId, amount, em);
      await this.accountsService.creditAccount(destAccount.accountId, amount, em);

      const txn = em.create(TransactionEntity, {
        transactionId: uuid(),
        transactionRef: generateRef('TRF'),
        transactionType: 'transfer',
        channel: 'internal',
        sourceAccountId: sourceAccount.accountId,
        destAccountId: destAccount.accountId,
        amount,
        fees: 0n,
        penalties: 0n,
        netAmount: amount,
        narration: dto.narration || 'Internal transfer',
        status: 'posted',
        businessDate: new Date(),
        initiatedBy,
        approvedBy: initiatedBy,
        approvedAt: new Date(),
        postedAt: new Date(),
        branchId,
      });
      return em.save(TransactionEntity, txn);
    });
  }

  /**
   * TRANSACTION REVERSAL (SRS 6.6)
   */
  async reverseTransaction(transactionId: string, reason: string, requestedBy: string) {
    const original = await this.repo.findOne({ where: { transactionId } });
    if (!original) throw new NotFoundException('Transaction not found');
    if (original.status === 'reversed') throw new BadRequestException('Transaction already reversed');
    if (original.status !== 'posted') throw new BadRequestException('Only posted transactions can be reversed');

    // Check reversal window (must be same business day)
    const today = new Date().toISOString().split('T')[0];
    const txnDate = original.businessDate?.toString().split('T')[0];
    if (today !== txnDate) {
      throw new BadRequestException('Reversal can only be done on the same business day');
    }

    // Create workflow for reversal approval
    const workflowReq = await this.workflow.createRequest({
      workflowType: 'reversal',
      entityType: 'transaction',
      entityId: transactionId,
      requestorId: requestedBy,
      amount: Number(original.amount),
      notes: reason,
    });

    return { status: 'pending_approval', workflowRequestId: workflowReq.requestId };
  }

  async executeReversal(transactionId: string, approvedBy: string) {
    const original = await this.repo.findOne({ where: { transactionId } });
    if (!original) throw new NotFoundException('Transaction not found');

    return await this.dataSource.transaction(async (em) => {
      // Undo the original transaction effects
      if (original.transactionType === 'deposit' && original.destAccountId) {
        await this.accountsService.debitAccount(original.destAccountId, original.netAmount, em);
      } else if (original.transactionType === 'withdrawal' && original.sourceAccountId) {
        await this.accountsService.creditAccount(original.sourceAccountId, original.netAmount + original.fees, em);
      }

      // Create reversal transaction
      const reversal = em.create(TransactionEntity, {
        transactionId: uuid(),
        transactionRef: generateRef('REV'),
        transactionType: 'reversal',
        channel: original.channel,
        sourceAccountId: original.destAccountId,
        destAccountId: original.sourceAccountId,
        amount: original.amount,
        fees: 0n,
        penalties: 0n,
        netAmount: original.netAmount,
        narration: `Reversal of ${original.transactionRef}`,
        status: 'posted',
        businessDate: new Date(),
        initiatedBy: approvedBy,
        approvedBy,
        approvedAt: new Date(),
        postedAt: new Date(),
        branchId: original.branchId,
        reversalOf: original.transactionId,
      });
      const savedReversal = await em.save(TransactionEntity, reversal);

      // Mark original as reversed
      await em.update(TransactionEntity, { transactionId }, { status: 'reversed', reversedBy: savedReversal.transactionId });

      return savedReversal;
    });
  }

  async findById(transactionId: string) {
    const txn = await this.repo.findOne({ where: { transactionId } });
    if (!txn) throw new NotFoundException('Transaction not found');
    return txn;
  }

  async findByRef(transactionRef: string) {
    const txn = await this.repo.findOne({ where: { transactionRef } });
    if (!txn) throw new NotFoundException('Transaction not found');
    return txn;
  }

  private verifyNameMatch(providedName: string, account: any): { matched: boolean; systemName: string } {
    // Get customer name from DB
    // Simplified — in practice, would join with customers table
    const systemName = account.customerName || '';
    const normalise = (s: string) => s.toLowerCase().trim().replace(/\s+/g, ' ');
    const providedNorm = normalise(providedName);
    const systemNorm = normalise(systemName);

    // Exact or substantial match (allows for middle name differences)
    const matched = providedNorm === systemNorm ||
      systemNorm.includes(providedNorm) ||
      providedNorm.includes(systemNorm.split(' ')[0]);

    return { matched, systemName };
  }

  private async getTellerDrawer(tellerId: string, branchId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [drawer] = await this.repo.manager.query(
      `SELECT * FROM teller_drawers WHERE teller_user_id = $1 AND business_date = $2 AND status = 'open'`,
      [tellerId, today]
    );
    return drawer;
  }

  private async getWithdrawalThresholds() {
    return { supervisorThreshold: 50000000 }; // GHS 500,000 (50000000 pesewas) default
  }
}

// ============================================================
// src/modules/transactions/transactions.controller.ts
// ============================================================
import {
  Controller, Get, Post, Body, Param, Query, UseGuards, Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TransactionsService } from './transactions.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser, IdempotencyKey } from '../../common/decorators/current-user.decorator';
import { IsString, IsOptional, IsNumber, IsPositive, Min } from 'class-validator';
import { Type } from 'class-transformer';

class TellerDepositDto {
  @IsString() accountNumber: string;
  @IsString() customerName: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() productCode?: string;
  @IsOptional() @IsString() narration?: string;
  @IsOptional() @IsString() drawerRef?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

class TellerWithdrawalDto {
  @IsString() accountNumber: string;
  @IsString() customerName: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() narration?: string;
  @IsOptional() @IsString() idempotencyKey?: string;
}

class TransferDto {
  @IsString() sourceAccountNumber: string;
  @IsString() destAccountNumber: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() narration?: string;
}

@ApiTags('transactions')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('transactions')
export class TransactionsController {
  constructor(private txnService: TransactionsService) {}

  @Post('deposit')
  @Roles('teller','branch_manager','admin','super_admin')
  deposit(
    @Body() dto: TellerDepositDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.txnService.tellerDeposit(dto, userId, branchId);
  }

  @Post('withdrawal')
  @Roles('teller','branch_manager','admin','super_admin')
  withdrawal(
    @Body() dto: TellerWithdrawalDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.txnService.tellerWithdrawal(dto, userId, branchId);
  }

  @Post('transfer')
  @Roles('teller','branch_manager','admin','super_admin','accountant')
  transfer(
    @Body() dto: TransferDto,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.txnService.internalTransfer(dto, userId, branchId);
  }

  @Post(':transactionId/reverse')
  @Roles('teller','branch_manager','admin','super_admin')
  reverse(
    @Param('transactionId') transactionId: string,
    @Body('reason') reason: string,
    @CurrentUser('userId') userId: string,
  ) {
    return this.txnService.reverseTransaction(transactionId, reason, userId);
  }

  @Get(':transactionId')
  findOne(@Param('transactionId') transactionId: string) {
    return this.txnService.findById(transactionId);
  }

  @Get('by-ref/:ref')
  findByRef(@Param('ref') ref: string) {
    return this.txnService.findByRef(ref);
  }
}

// ============================================================
// src/modules/teller/teller.module.ts + teller.service.ts
// ============================================================
@Module({
  imports: [TypeOrmModule.forFeature([TransactionEntity]), AuditModule],
  controllers: [TellerController],
  providers: [TellerService],
  exports: [TellerService],
})
export class TellerModule {}

@Injectable()
export class TellerService {
  constructor(
    @InjectRepository(TransactionEntity) private repo: Repository<TransactionEntity>,
    private audit: AuditService,
  ) {}

  async openDrawer(tellerId: string, branchId: string, openingBalance: number) {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.repo.manager.findOne('teller_drawers', {
      where: { teller_user_id: tellerId, business_date: today }
    });
    if (existing) throw new ConflictException('Drawer already opened for today');

    await this.repo.manager.query(
      `INSERT INTO teller_drawers (drawer_id, teller_user_id, branch_id, business_date, opening_balance, closing_balance, status)
       VALUES ($1, $2, $3, $4, $5, $5, 'open')`,
      [uuid(), tellerId, branchId, today, openingBalance.toString()]
    );
    await this.audit.log({ actorUserId: tellerId, actorRole: 'teller', actionType: 'DRAWER_OPENED', entityType: 'drawer', entityId: tellerId });
    return { message: 'Teller drawer opened', date: today };
  }

  async closeDrawer(tellerId: string, branchId: string, physicalCount: number) {
    const today = new Date().toISOString().split('T')[0];
    const [drawer] = await this.repo.manager.query(
      `SELECT * FROM teller_drawers WHERE teller_user_id = $1 AND business_date = $2 AND status = 'open'`,
      [tellerId, today]
    );
    if (!drawer) throw new NotFoundException('No open drawer for today');

    const systemBalance = Number(drawer.closing_balance || drawer.opening_balance);
    const variance = physicalCount - systemBalance;

    await this.repo.manager.query(
      `UPDATE teller_drawers SET status = 'closed', closed_at = NOW(), closing_balance = $1 WHERE drawer_id = $2`,
      [physicalCount.toString(), drawer.drawer_id]
    );

    await this.audit.log({
      actorUserId: tellerId,
      actorRole: 'teller',
      actionType: 'DRAWER_CLOSED',
      entityType: 'drawer',
      entityId: drawer.drawer_id,
      afterValue: { systemBalance, physicalCount, variance },
    });

    return { systemBalance, physicalCount, variance, balanced: variance === 0 };
  }

  async getDrawerSummary(tellerId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [drawer] = await this.repo.manager.query(
      `SELECT d.*, 
        COUNT(t.*) as transaction_count,
        SUM(CASE WHEN t.transaction_type='deposit' THEN t.amount ELSE 0 END) as total_deposits,
        SUM(CASE WHEN t.transaction_type='withdrawal' THEN t.amount ELSE 0 END) as total_withdrawals
       FROM teller_drawers d
       LEFT JOIN transactions t ON t.drawer_id = d.drawer_id
       WHERE d.teller_user_id = $1 AND d.business_date = $2
       GROUP BY d.drawer_id`,
      [tellerId, today]
    );
    return drawer;
  }
}

@Controller('teller')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth('JWT')
@ApiTags('teller')
export class TellerController {
  constructor(private tellerService: TellerService) {}

  @Post('drawer/open')
  @Roles('teller','branch_manager')
  openDrawer(
    @Body('openingBalance') openingBalance: number,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.tellerService.openDrawer(userId, branchId, openingBalance);
  }

  @Post('drawer/close')
  @Roles('teller','branch_manager')
  closeDrawer(
    @Body('physicalCount') physicalCount: number,
    @CurrentUser('userId') userId: string,
    @CurrentUser('branchId') branchId: string,
  ) {
    return this.tellerService.closeDrawer(userId, branchId, physicalCount);
  }

  @Get('drawer/summary')
  @Roles('teller','branch_manager','admin')
  getDrawerSummary(@CurrentUser('userId') userId: string) {
    return this.tellerService.getDrawerSummary(userId);
  }
}

// ── COMPLIANCE ALERT HELPER (appended) ──────────────────────
// Called after every transaction to flag high-value and suspicious activity
async function generateComplianceAlert(ds: any, txn: any, threshold = 500000000n) {
  const amount = BigInt(txn.amount || 0);
  if (amount < threshold) return; // Below GHS 5,000 threshold

  try {
    const { v4: uuid } = require('uuid');
    await ds.query(
      `INSERT INTO compliance_alerts
        (alert_id, alert_type, severity, entity_type, entity_id, customer_id, transaction_id, description, status)
       SELECT $1, 'high_value', CASE WHEN $2 >= 100000000 THEN 'high' ELSE 'medium' END,
              'transaction', $3::uuid, a.customer_id, $3::uuid,
              'High-value transaction: GHS ' || ROUND($2::numeric / 100, 2) || ' via ' || $4,
              'open'
       FROM transactions t
       LEFT JOIN accounts acc ON acc.account_id = COALESCE(t.source_account_id, t.dest_account_id)
       LEFT JOIN (SELECT account_id, customer_id FROM accounts) a ON a.account_id = COALESCE(t.source_account_id, t.dest_account_id)
       WHERE t.transaction_id = $3
       LIMIT 1`,
      [uuid(), amount.toString(), txn.transactionId, txn.channel]
    );
  } catch (_) { /* non-blocking */ }
}
