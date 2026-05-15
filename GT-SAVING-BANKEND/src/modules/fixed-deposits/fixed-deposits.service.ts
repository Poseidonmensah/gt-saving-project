// ============================================================
// FIXED DEPOSITS MODULE
// src/modules/fixed-deposits/fixed-deposits.service.ts
// ============================================================
import { Injectable, NotFoundException, BadRequestException, ForbiddenException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Cron } from '@nestjs/schedule';
import { addDays } from 'date-fns';
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { FinancialMath, generateRef } from '../../common/utils/financial.util';
import { AuditService } from '../audit/audit.service';
import { LedgerService } from '../ledger/ledger.service';
import { AccountsService } from '../accounts/accounts.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';

@Entity('fixed_deposits')
export class FixedDepositEntity {
  @PrimaryColumn({ name: 'fd_id' }) fdId: string;
  @Column({ name: 'fd_number', unique: true }) fdNumber: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'source_account_id' }) sourceAccountId: string;
  @Column({ name: 'product_code' }) productCode: string;
  @Column({ name: 'principal_amount', type: 'bigint' }) principalAmount: bigint;
  @Column({ name: 'interest_rate_pa', type: 'decimal', precision: 10, scale: 6 }) interestRatePa: string;
  @Column({ name: 'tenor_days' }) tenorDays: number;
  @Column({ name: 'placement_date', type: 'date' }) placementDate: Date;
  @Column({ name: 'maturity_date', type: 'date' }) maturityDate: Date;
  @Column({ name: 'maturity_value', type: 'bigint' }) maturityValue: bigint;
  @Column({ name: 'accrued_interest', type: 'bigint', default: 0 }) accruedInterest: bigint;
  @Column({ name: 'auto_rollover', default: false }) autoRollover: boolean;
  @Column({ name: 'rollover_count', default: 0 }) rolloverCount: number;
  @Column({ name: 'maturity_instruction', default: 'payout' }) maturityInstruction: string;
  @Column({ name: 'payout_account_id', nullable: true }) payoutAccountId: string;
  @Column({ name: 'status', default: 'pending' }) status: string;
  @Column({ name: 'broken_at', type: 'date', nullable: true }) brokenAt: Date;
  @Column({ name: 'breakage_penalty', type: 'bigint', nullable: true }) breakagePenalty: bigint;
  @Column({ name: 'break_reason', nullable: true }) breakReason: string;
  @Column({ name: 'notice_sent', default: false }) noticeSent: boolean;
  @Column({ name: 'notice_sent_at', nullable: true }) noticeSentAt: Date;
  @Column({ name: 'branch_id' }) branchId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Injectable()
export class FixedDepositsService {
  private readonly logger = new Logger(FixedDepositsService.name);

  constructor(
    @InjectRepository(FixedDepositEntity) private repo: Repository<FixedDepositEntity>,
    private dataSource: DataSource,
    private accountsService: AccountsService,
    private ledger: LedgerService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private workflow: WorkflowService,
  ) {}

  async place(dto: PlaceFDDto, createdBy: string): Promise<FixedDepositEntity> {
    const sourceAccount = await this.accountsService.findById(dto.sourceAccountId);
    if (sourceAccount.status !== 'active') throw new BadRequestException('Source account is not active');

    const amount = BigInt(dto.principalAmount);
    if (sourceAccount.availableBalance < amount) {
      throw new BadRequestException(`Insufficient balance. Available: ${FinancialMath.format(sourceAccount.availableBalance)}`);
    }

    // Get product config
    const [product] = await this.repo.manager.query(
      `SELECT * FROM product_configs WHERE product_code = $1`, [dto.productCode]
    );
    if (!product) throw new NotFoundException('FD product not found');

    const placementDate = new Date();
    const maturityDate = addDays(placementDate, dto.tenorDays);
    const { interest, maturityValue } = FinancialMath.calcFDMaturityValue(
      amount, product.interest_rate_pa, dto.tenorDays
    );

    const fdNumber = await this.generateFDNumber();

    return await this.dataSource.transaction(async (em) => {
      // Debit source account
      await this.accountsService.debitAccount(dto.sourceAccountId, amount, em);

      // Create FD record
      const fd = em.create(FixedDepositEntity, {
        fdId: uuid(),
        fdNumber,
        customerId: dto.customerId,
        sourceAccountId: dto.sourceAccountId,
        productCode: dto.productCode,
        principalAmount: amount,
        interestRatePa: product.interest_rate_pa,
        tenorDays: dto.tenorDays,
        placementDate,
        maturityDate,
        maturityValue,
        accruedInterest: 0n,
        autoRollover: dto.autoRollover || false,
        maturityInstruction: dto.maturityInstruction || 'payout',
        payoutAccountId: dto.payoutAccountId || dto.sourceAccountId,
        status: 'active',
        branchId: sourceAccount.branchId,
        createdBy,
      });
      const savedFD = await em.save(FixedDepositEntity, fd);

      // Post to GL — Dr: FD Control / Cr: Customer Savings
      await this.ledger.postFDPlacementJournal(em, {
        fdId: savedFD.fdId,
        amount,
        productCode: dto.productCode,
        branchId: sourceAccount.branchId,
        narration: `FD placement - ${fdNumber}`,
      });

      await this.audit.log({
        actorUserId: createdBy,
        actorRole: 'teller',
        actionType: 'FD_PLACED',
        entityType: 'fixed_deposit',
        entityId: savedFD.fdId,
        afterValue: { fdNumber, amount: amount.toString(), maturityDate },
      });

      return savedFD;
    });
  }

  async earlyLiquidation(fdId: string, reason: string, requestedBy: string) {
    const fd = await this.findById(fdId);
    if (fd.status !== 'active') throw new BadRequestException('FD is not active');

    // Require approval for early breakage
    const req = await this.workflow.createRequest({
      workflowType: 'fd_break',
      entityType: 'fixed_deposit',
      entityId: fdId,
      requestorId: requestedBy,
      amount: Number(fd.principalAmount),
      notes: reason,
    });

    return { status: 'pending_approval', workflowRequestId: req.requestId };
  }

  async executeEarlyLiquidation(fdId: string, approvedBy: string) {
    const fd = await this.findById(fdId);

    const [product] = await this.repo.manager.query(
      `SELECT * FROM product_configs WHERE product_code = $1`, [fd.productCode]
    );

    const daysHeld = Math.floor((Date.now() - new Date(fd.placementDate).getTime()) / (1000 * 60 * 60 * 24));
    const earnedInterest = FinancialMath.calcDailyInterest(fd.principalAmount, fd.interestRatePa, daysHeld);
    const penaltyRate = product.early_breakage_penalty_rate || '0.02';
    const penalty = FinancialMath.calcFee(fd.principalAmount, 'percentage', undefined, penaltyRate);
    const payoutAmount = fd.principalAmount + earnedInterest - penalty;

    await this.dataSource.transaction(async (em) => {
      // Credit payout account
      await this.accountsService.creditAccount(fd.payoutAccountId || fd.sourceAccountId, payoutAmount, em);

      await em.update(FixedDepositEntity, { fdId }, {
        status: 'broken',
        brokenAt: new Date(),
        breakagePenalty: penalty,
        breakReason: 'early_liquidation',
      });

      await this.ledger.postFDBreakJournal(em, {
        fdId,
        principal: fd.principalAmount,
        earnedInterest,
        penalty,
        branchId: fd.branchId,
        narration: `FD early liquidation - ${fd.fdNumber}`,
      });
    });

    await this.audit.log({
      actorUserId: approvedBy,
      actorRole: 'branch_manager',
      actionType: 'FD_EARLY_BROKEN',
      entityType: 'fixed_deposit',
      entityId: fdId,
      afterValue: { penalty: penalty.toString(), payout: payoutAmount.toString() },
    });
  }

  // Maturity processing — runs daily at 6 AM
  @Cron('0 6 * * *')
  async processMaturities() {
    this.logger.log('Processing FD maturities...');
    const today = new Date();

    // Send 7-day advance notices
    const sevenDaysOut = addDays(today, 7);
    const upcomingMaturities = await this.repo.query(
      `SELECT fd.*, c.phone_number, c.full_name FROM fixed_deposits fd
       JOIN customers c ON c.customer_id = fd.customer_id
       WHERE fd.maturity_date = $1 AND fd.status = 'active' AND fd.notice_sent = false`,
      [sevenDaysOut.toISOString().split('T')[0]]
    );

    for (const fd of upcomingMaturities) {
      await this.notifications.sendSms(
        fd.phone_number,
        `Dear ${fd.full_name}, your Fixed Deposit ${fd.fd_number} of ${FinancialMath.format(BigInt(fd.principal_amount))} matures on ${new Date(fd.maturity_date).toLocaleDateString('en-GH')}. Maturity value: ${FinancialMath.format(BigInt(fd.maturity_value))}. Please contact us with maturity instructions.`
      );
      await this.repo.update({ fdId: fd.fd_id }, { noticeSent: true, noticeSentAt: new Date() });
    }

    // Process matured FDs
    const maturedFDs = await this.repo.query(
      `SELECT fd.*, c.phone_number, c.full_name FROM fixed_deposits fd
       JOIN customers c ON c.customer_id = fd.customer_id
       WHERE fd.maturity_date <= $1 AND fd.status = 'active'`,
      [today.toISOString().split('T')[0]]
    );

    for (const fd of maturedFDs) {
      try {
        await this.dataSource.transaction(async (em) => {
          if (fd.auto_rollover || fd.maturity_instruction === 'rollover') {
            // Rollover FD
            const newMaturityDate = addDays(new Date(), fd.tenor_days);
            const { interest: newInterest, maturityValue: newMatValue } = FinancialMath.calcFDMaturityValue(
              BigInt(fd.principal_amount), fd.interest_rate_pa, fd.tenor_days
            );
            await em.update(FixedDepositEntity, { fdId: fd.fd_id }, {
              status: 'active',
              placementDate: today,
              maturityDate: newMaturityDate,
              maturityValue: newMatValue,
              accruedInterest: 0n,
              rolloverCount: fd.rollover_count + 1,
              noticeSent: false,
            });
          } else {
            // Payout principal + interest
            const payoutAmount = BigInt(fd.maturity_value);
            await this.accountsService.creditAccount(fd.payout_account_id || fd.source_account_id, payoutAmount, em);
            await em.update(FixedDepositEntity, { fdId: fd.fd_id }, { status: 'closed' });

            await this.ledger.postFDMaturityJournal(em, {
              fdId: fd.fd_id,
              principal: BigInt(fd.principal_amount),
              interest: BigInt(fd.maturity_value) - BigInt(fd.principal_amount),
              branchId: fd.branch_id,
              narration: `FD maturity payout - ${fd.fd_number}`,
            });
          }
        });

        await this.notifications.sendSms(
          fd.phone_number,
          `Dear ${fd.full_name}, your Fixed Deposit ${fd.fd_number} has matured. ${fd.auto_rollover ? 'It has been automatically rolled over for another term.' : `${FinancialMath.format(BigInt(fd.maturity_value))} has been credited to your account.`}`
        );
      } catch (err) {
        this.logger.error(`FD maturity processing error for ${fd.fd_id}: ${err.message}`);
      }
    }
  }

  async findById(fdId: string): Promise<FixedDepositEntity> {
    const fd = await this.repo.findOne({ where: { fdId } });
    if (!fd) throw new NotFoundException('Fixed deposit not found');
    return fd;
  }

  async findByCustomer(customerId: string) {
    return this.repo.find({ where: { customerId }, order: { createdAt: 'DESC' } });
  }

  private async generateFDNumber(): Promise<string> {
    const result = await this.repo.manager.query(`SELECT generate_fd_number() as num`);
    return result[0].num;
  }
}

// ============================================================
// GENERAL LEDGER MODULE
// src/modules/ledger/ledger.service.ts
// ============================================================
@Injectable()
export class LedgerService {
  private readonly logger = new Logger('LedgerService');

  constructor(
    @InjectRepository(JournalEntryEntity) private journalRepo: Repository<JournalEntryEntity>,
    @InjectRepository(LedgerEntryEntity) private ledgerRepo: Repository<LedgerEntryEntity>,
  ) {}

  /**
   * Core double-entry posting engine
   */
  async postJournal(em: any, entries: JournalLine[], metadata: JournalMetadata): Promise<any> {
    // Validate balance
    const totalDebits = entries.filter(e => e.type === 'debit').reduce((s, e) => s + e.amount, 0n);
    const totalCredits = entries.filter(e => e.type === 'credit').reduce((s, e) => s + e.amount, 0n);

    if (totalDebits !== totalCredits) {
      throw new Error(`Unbalanced journal: DR=${totalDebits} CR=${totalCredits}`);
    }

    const journalNo = await this.generateJournalNo();
    const journal = {
      journalId: uuid(),
      journalNo,
      transactionId: metadata.transactionId,
      postingDate: new Date(),
      narration: metadata.narration,
      totalDebits,
      totalCredits,
      postedBy: metadata.postedBy || 'system',
    };

    const savedJournal = await em.save('journal_entries', journal);

    for (const entry of entries) {
      await em.save('ledger_entries', {
        entryId: uuid(),
        journalId: savedJournal.journalId,
        accountCode: entry.accountCode,
        entryType: entry.type,
        amount: entry.amount,
        narration: entry.narration || metadata.narration,
        branchId: metadata.branchId,
      });
    }

    // Update GL balances
    await this.updateGLBalances(em, entries, metadata.branchId);

    return savedJournal;
  }

  // ─── SPECIFIC JOURNAL TEMPLATES ─────────────────────────

  async postDepositJournal(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '1102', amount: ctx.amount, narration: 'Cash deposit - teller drawer' },
      { type: 'credit', accountCode: '2101', amount: ctx.amount - ctx.feeAmount, narration: 'Customer deposit credit' },
    ];
    if (ctx.feeAmount > 0n) {
      entries[0].amount = ctx.amount;
      entries.push({ type: 'credit', accountCode: '4203', amount: ctx.feeAmount, narration: 'Deposit fee income' });
    }
    return this.postJournal(em, entries, { transactionId: ctx.transactionId, narration: ctx.narration, branchId: ctx.branchId });
  }

  async postWithdrawalJournal(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2101', amount: ctx.amount + ctx.feeAmount },
      { type: 'credit', accountCode: '1102', amount: ctx.amount },
    ];
    if (ctx.feeAmount > 0n) {
      entries.push({ type: 'credit', accountCode: '4203', amount: ctx.feeAmount });
    }
    return this.postJournal(em, entries, { transactionId: ctx.transactionId, narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanDisbursementJournal(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '1301', amount: ctx.amount, narration: 'Loan disbursed - principal' },
      { type: 'credit', accountCode: '2101', amount: ctx.amount - ctx.processingFee, narration: 'Credit to customer account' },
    ];
    if (ctx.processingFee > 0n) {
      entries.push({ type: 'credit', accountCode: '4201', amount: ctx.processingFee, narration: 'Processing fee income' });
    }
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanRepaymentJournal(em: any, ctx: any) {
    const totalReceived = ctx.principalPaid + ctx.interestPaid + ctx.penaltyPaid;
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2101', amount: totalReceived, narration: 'Loan repayment received' },
      { type: 'credit', accountCode: '1301', amount: ctx.principalPaid, narration: 'Principal repaid' },
    ];
    if (ctx.interestPaid > 0n) {
      entries.push({ type: 'credit', accountCode: '4101', amount: ctx.interestPaid, narration: 'Interest income received' });
    }
    if (ctx.penaltyPaid > 0n) {
      entries.push({ type: 'credit', accountCode: '4301', amount: ctx.penaltyPaid, narration: 'Penalty income received' });
    }
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanWriteOffJournal(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '1304', amount: ctx.principalAmount, narration: 'Loan write-off' },
      { type: 'credit', accountCode: '1301', amount: ctx.principalAmount, narration: 'Remove from loans receivable' },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDPlacementJournal(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2101', amount: ctx.amount, narration: 'FD placement from savings' },
      { type: 'credit', accountCode: '2201', amount: ctx.amount, narration: 'Fixed deposit liability' },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDBreakJournal(em: any, ctx: any) {
    const totalPayout = ctx.principal + ctx.earnedInterest - ctx.penalty;
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2201', amount: ctx.principal },
      { type: 'credit', accountCode: '2101', amount: totalPayout },
      { type: 'credit', accountCode: '4302', amount: ctx.penalty },
    ];
    if (ctx.earnedInterest > 0n) {
      entries[2].amount += 0n;
      entries.push({ type: 'debit', accountCode: '5101', amount: ctx.earnedInterest });
      entries.push({ type: 'credit', accountCode: '2202', amount: ctx.earnedInterest });
    }
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDMaturityJournal(em: any, ctx: any) {
    const totalPayout = ctx.principal + ctx.interest;
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2201', amount: ctx.principal },
      { type: 'debit', accountCode: '5101', amount: ctx.interest },
      { type: 'credit', accountCode: '2101', amount: totalPayout },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postSavingsInterestAccrual(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '5100', amount: ctx.amount },
      { type: 'credit', accountCode: '2500', amount: ctx.amount },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postSavingsInterestPosting(em: any, ctx: any) {
    const entries: JournalLine[] = [
      { type: 'debit', accountCode: '2500', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postMobileMoneyJournal(em: any, ctx: any) {
    const entries: JournalLine[] = ctx.direction === 'inbound' ? [
      { type: 'debit', accountCode: '1202', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount },
    ] : [
      { type: 'debit', accountCode: '2101', amount: ctx.amount },
      { type: 'credit', accountCode: '1202', amount: ctx.amount },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  // ─── GL QUERIES ──────────────────────────────────────────

  async getTrialBalance(date: Date, branchId?: string) {
    const where = branchId ? `AND b.branch_id = '${branchId}'` : '';
    return this.journalRepo.query(
      `SELECT coa.account_code, coa.account_name, coa.account_class, coa.normal_balance,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) as total_debits,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) as total_credits,
        CASE WHEN coa.normal_balance = 'debit'
          THEN COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) - COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0)
          ELSE COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) - COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0)
        END as net_balance
       FROM chart_of_accounts coa
       LEFT JOIN ledger_entries le ON le.account_code = coa.account_code
       LEFT JOIN journal_entries j ON j.journal_id = le.journal_id AND j.posting_date <= $1
       WHERE coa.is_active = true ${where}
       GROUP BY coa.account_code, coa.account_name, coa.account_class, coa.normal_balance
       ORDER BY coa.account_code`,
      [date]
    );
  }

  async getAccountLedger(accountCode: string, fromDate: Date, toDate: Date) {
    return this.ledgerRepo.query(
      `SELECT le.*, j.journal_no, j.narration as journal_narration, j.posting_date
       FROM ledger_entries le
       JOIN journal_entries j ON j.journal_id = le.journal_id
       WHERE le.account_code = $1 AND j.posting_date BETWEEN $2 AND $3
       ORDER BY j.posting_date, le.created_at`,
      [accountCode, fromDate, toDate]
    );
  }

  async getJournal(journalId: string) {
    const journal = await this.journalRepo.findOne({ where: { journalId } });
    if (!journal) throw new NotFoundException('Journal not found');
    const entries = await this.ledgerRepo.find({ where: { journalId } });
    return { journal, entries };
  }

  private async updateGLBalances(em: any, entries: JournalLine[], branchId: string) {
    const today = new Date().toISOString().split('T')[0];
    for (const entry of entries) {
      await em.query(
        `INSERT INTO gl_account_balances (balance_id, account_code, period_date, opening_balance, total_debits, total_credits, closing_balance, branch_id)
         VALUES ($1, $2, $3, 0, $4, $5, $4 - $5, $6)
         ON CONFLICT (account_code, period_date, branch_id) DO UPDATE SET
           total_debits = gl_account_balances.total_debits + $4,
           total_credits = gl_account_balances.total_credits + $5,
           closing_balance = gl_account_balances.closing_balance + ($4 - $5),
           updated_at = NOW()`,
        [uuid(), entry.accountCode, today,
         entry.type === 'debit' ? entry.amount.toString() : '0',
         entry.type === 'credit' ? entry.amount.toString() : '0',
         branchId || null]
      );
    }
  }

  private async generateJournalNo(): Promise<string> {
    const result = await this.journalRepo.manager.query(`SELECT generate_journal_no() as num`);
    return result[0].num;
  }
}

// ============================================================
// INTEREST ENGINE
// src/modules/interest-engine/interest-engine.service.ts
// ============================================================
@Injectable()
export class InterestEngineService {
  private readonly logger = new Logger('InterestEngine');

  constructor(
    private ledger: LedgerService,
    private dataSource: DataSource,
  ) {}

  // Daily savings interest accrual — runs at 11 PM
  @Cron('0 23 * * *')
  async accrualDailySavingsInterest() {
    this.logger.log('Running daily savings interest accrual...');
    const today = new Date();

    const accounts = await this.dataSource.query(
      `SELECT a.account_id, a.current_balance, a.product_code, p.interest_rate_pa
       FROM accounts a
       JOIN product_configs p ON p.product_code = a.product_code
       WHERE a.status = 'active'
         AND a.account_type = 'savings'
         AND a.current_balance > 0
         AND p.interest_rate_pa > 0
         AND NOT EXISTS (
           SELECT 1 FROM interest_accruals ia
           WHERE ia.account_id = a.account_id AND ia.accrual_date = $1
         )`,
      [today.toISOString().split('T')[0]]
    );

    let processed = 0;
    for (const account of accounts) {
      try {
        const daysInYear = today.getFullYear() % 4 === 0 ? 366 : 365;
        const interestAmount = FinancialMath.calcDailyInterest(
          BigInt(account.current_balance),
          account.interest_rate_pa,
          1,
          daysInYear
        );

        if (interestAmount > 0n) {
          await this.dataSource.query(
            `INSERT INTO interest_accruals
              (accrual_id, accrual_date, account_id, product_code, balance_snapshot, rate_applied, days, accrued_amount)
             VALUES ($1, $2, $3, $4, $5, $6, 1, $7)`,
            [uuid(), today, account.account_id, account.product_code,
             account.current_balance.toString(), account.interest_rate_pa, interestAmount.toString()]
          );

          // Accumulate on account
          await this.dataSource.query(
            `UPDATE accounts SET accrued_interest = accrued_interest + $1 WHERE account_id = $2`,
            [interestAmount.toString(), account.account_id]
          );
          processed++;
        }
      } catch (err) {
        this.logger.error(`Interest accrual error for account ${account.account_id}: ${err.message}`);
      }
    }

    this.logger.log(`Interest accrual complete. Processed ${processed} accounts.`);
  }

  // Monthly interest posting — runs on 1st of each month
  @Cron('0 2 1 * *')
  async postMonthlyInterest() {
    this.logger.log('Posting monthly savings interest...');
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const accrualsToPost = await this.dataSource.query(
      `SELECT account_id, SUM(accrued_amount) as total_interest, product_code, MAX(rate_applied) as rate
       FROM interest_accruals
       WHERE accrual_date BETWEEN $1 AND $2 AND posted_to_journal = false AND account_id IS NOT NULL
       GROUP BY account_id, product_code`,
      [monthStart, monthEnd]
    );

    for (const row of accrualsToPost) {
      try {
        await this.dataSource.transaction(async (em) => {
          const totalInterest = BigInt(row.total_interest);

          // Credit interest to savings account
          await em.query(
            `UPDATE accounts SET
              current_balance = current_balance + $1,
              available_balance = available_balance + $1,
              accrued_interest = accrued_interest - $1
             WHERE account_id = $2`,
            [totalInterest.toString(), row.account_id]
          );

          const journal = await this.ledger.postSavingsInterestPosting(em, {
            amount: totalInterest,
            branchId: null,
            narration: `Monthly savings interest - ${monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })}`,
          });

          // Mark accruals as posted
          await em.query(
            `UPDATE interest_accruals SET posted_to_journal = true, journal_id = $1
             WHERE account_id = $2 AND accrual_date BETWEEN $3 AND $4`,
            [journal.journalId, row.account_id, monthStart, monthEnd]
          );
        });
      } catch (err) {
        this.logger.error(`Monthly interest posting error for account ${row.account_id}: ${err.message}`);
      }
    }
    this.logger.log(`Monthly interest posting complete.`);
  }

  // FD daily interest accrual
  @Cron('0 23 * * *')
  async accrualFDInterest() {
    const today = new Date();
    const activeFDs = await this.dataSource.query(
      `SELECT fd.fd_id, fd.principal_amount, fd.interest_rate_pa, fd.product_code
       FROM fixed_deposits fd
       WHERE fd.status = 'active' AND fd.maturity_date >= $1
         AND NOT EXISTS (
           SELECT 1 FROM interest_accruals ia WHERE ia.fd_id = fd.fd_id AND ia.accrual_date = $1
         )`,
      [today.toISOString().split('T')[0]]
    );

    for (const fd of activeFDs) {
      const dailyInterest = FinancialMath.calcDailyInterest(BigInt(fd.principal_amount), fd.interest_rate_pa);
      await this.dataSource.query(
        `INSERT INTO interest_accruals (accrual_id, accrual_date, fd_id, product_code, balance_snapshot, rate_applied, days, accrued_amount)
         VALUES ($1,$2,$3,$4,$5,$6,1,$7)`,
        [uuid(), today, fd.fd_id, fd.product_code, fd.principal_amount, fd.interest_rate_pa, dailyInterest.toString()]
      );
      await this.dataSource.query(
        `UPDATE fixed_deposits SET accrued_interest = accrued_interest + $1 WHERE fd_id = $2`,
        [dailyInterest.toString(), fd.fd_id]
      );
    }
  }
}

// ============================================================
// FEES MODULE
// src/modules/fees/fees.service.ts
// ============================================================
@Injectable()
export class FeesService {
  constructor(private dataSource: DataSource) {}

  async calculateFee(feeCode: string, productCode: string, amount: number): Promise<number> {
    const [config] = await this.dataSource.query(
      `SELECT * FROM fee_configs
       WHERE (product_code = $1 OR product_code = 'ALL')
         AND fee_code = $2
         AND is_active = true
         AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
       ORDER BY product_code DESC LIMIT 1`,
      [productCode, feeCode]
    );

    if (!config) return 0;

    const fee = FinancialMath.calcFee(
      BigInt(amount),
      config.fee_type,
      config.flat_amount ? BigInt(config.flat_amount) : undefined,
      config.percentage_rate?.toString(),
      config.tier_config,
    );

    const minFee = config.min_amount ? BigInt(config.min_amount) : 0n;
    const maxFee = config.max_amount ? BigInt(config.max_amount) : BigInt(Number.MAX_SAFE_INTEGER);

    let finalFee = fee;
    if (finalFee < minFee) finalFee = minFee;
    if (finalFee > maxFee) finalFee = maxFee;

    return Number(finalFee);
  }
}

// ─── Entity stubs for Ledger ─────────────────────────────────
@Entity('journal_entries')
export class JournalEntryEntity {
  @PrimaryColumn({ name: 'journal_id' }) journalId: string;
  @Column({ name: 'journal_no', unique: true }) journalNo: string;
  @Column({ name: 'transaction_id', nullable: true }) transactionId: string;
  @Column({ name: 'posting_date', type: 'date' }) postingDate: Date;
  @Column({ name: 'narration' }) narration: string;
  @Column({ name: 'total_debits', type: 'bigint' }) totalDebits: bigint;
  @Column({ name: 'total_credits', type: 'bigint' }) totalCredits: bigint;
  @Column({ name: 'posted_by' }) postedBy: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Entity('ledger_entries')
export class LedgerEntryEntity {
  @PrimaryColumn({ name: 'entry_id' }) entryId: string;
  @Column({ name: 'journal_id' }) journalId: string;
  @Column({ name: 'account_code' }) accountCode: string;
  @Column({ name: 'entry_type' }) entryType: string;
  @Column({ name: 'amount', type: 'bigint' }) amount: bigint;
  @Column({ name: 'narration', nullable: true }) narration: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

interface JournalLine {
  type: 'debit' | 'credit';
  accountCode: string;
  amount: bigint;
  narration?: string;
}

interface JournalMetadata {
  transactionId?: string;
  narration: string;
  branchId?: string;
  postedBy?: string;
}

// ── search (appended) ─────────────────────────────────────────
async search(query: any): Promise<any> {
  const qb = this.repo.createQueryBuilder('fd');
  if (query.customerId)  qb.andWhere('fd.customer_id = :c',  { c: query.customerId });
  if (query.status)      qb.andWhere('fd.status = :s',       { s: query.status });
  if (query.branchId)    qb.andWhere('fd.branch_id = :b',    { b: query.branchId });
  if (query.fdNumber)    qb.andWhere('fd.fd_number ILIKE :n',{ n: `%${query.fdNumber}%` });
  const page  = parseInt(query.page  || '1');
  const limit = parseInt(query.limit || '25');
  qb.orderBy('fd.created_at', 'DESC').skip((page-1)*limit).take(limit);
  const [data, total] = await qb.getManyAndCount();
  return { data, meta: { total, page, limit } };
}
