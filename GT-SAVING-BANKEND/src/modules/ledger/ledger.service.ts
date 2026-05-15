// Additional methods to append to LedgerService
// These complement the ledger.service.ts already generated in fixed-deposits.service.ts

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { JournalEntryEntity } from './ledger.module';
import { LedgerEntryEntity } from './ledger.module';
import { FinancialMath } from '../../common/utils/financial.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class LedgerService {
  constructor(
    @InjectRepository(JournalEntryEntity) private journalRepo: Repository<JournalEntryEntity>,
    @InjectRepository(LedgerEntryEntity) private ledgerRepo: Repository<LedgerEntryEntity>,
    private dataSource: DataSource,
    private audit: AuditService,
  ) {}

  async postJournal(em: any, entries: any[], metadata: any): Promise<any> {
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
      isReversal: metadata.isReversal || false,
    };
    const target = em || this.dataSource.manager;
    const savedJournal = await target.save('journal_entries', journal);
    for (const entry of entries) {
      await target.save('ledger_entries', {
        entryId: uuid(),
        journalId: savedJournal.journalId,
        accountCode: entry.accountCode,
        entryType: entry.type,
        amount: entry.amount,
        narration: entry.narration || metadata.narration,
        branchId: metadata.branchId,
      });
    }
    await this.updateGLBalances(target, entries, metadata.branchId);
    return savedJournal;
  }

  async postDepositJournal(em: any, ctx: any) {
    const entries: any[] = [
      { type: 'debit', accountCode: '1102', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount - ctx.feeAmount },
    ];
    if (ctx.feeAmount > 0n) {
      entries.push({ type: 'credit', accountCode: '4203', amount: ctx.feeAmount });
    }
    return this.postJournal(em, entries, { transactionId: ctx.transactionId, narration: ctx.narration, branchId: ctx.branchId });
  }

  async postWithdrawalJournal(em: any, ctx: any) {
    const entries: any[] = [
      { type: 'debit', accountCode: '2101', amount: ctx.amount + ctx.feeAmount },
      { type: 'credit', accountCode: '1102', amount: ctx.amount },
    ];
    if (ctx.feeAmount > 0n) {
      entries.push({ type: 'credit', accountCode: '4203', amount: ctx.feeAmount });
    }
    return this.postJournal(em, entries, { transactionId: ctx.transactionId, narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanDisbursementJournal(em: any, ctx: any) {
    const entries: any[] = [
      { type: 'debit', accountCode: '1301', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount - ctx.processingFee },
    ];
    if (ctx.processingFee > 0n) {
      entries.push({ type: 'credit', accountCode: '4201', amount: ctx.processingFee });
    }
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanRepaymentJournal(em: any, ctx: any) {
    const totalReceived = ctx.principalPaid + ctx.interestPaid + ctx.penaltyPaid;
    const entries: any[] = [
      { type: 'debit', accountCode: '2101', amount: totalReceived },
      { type: 'credit', accountCode: '1301', amount: ctx.principalPaid },
    ];
    if (ctx.interestPaid > 0n) entries.push({ type: 'credit', accountCode: '4101', amount: ctx.interestPaid });
    if (ctx.penaltyPaid > 0n) entries.push({ type: 'credit', accountCode: '4301', amount: ctx.penaltyPaid });
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postLoanWriteOffJournal(em: any, ctx: any) {
    return this.postJournal(em, [
      { type: 'debit', accountCode: '5300', amount: ctx.principalAmount },
      { type: 'credit', accountCode: '1301', amount: ctx.principalAmount },
    ], { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDPlacementJournal(em: any, ctx: any) {
    return this.postJournal(em, [
      { type: 'debit', accountCode: '2101', amount: ctx.amount },
      { type: 'credit', accountCode: '2201', amount: ctx.amount },
    ], { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDBreakJournal(em: any, ctx: any) {
    const totalPayout = ctx.principal + ctx.earnedInterest - ctx.penalty;
    return this.postJournal(em, [
      { type: 'debit', accountCode: '2201', amount: ctx.principal },
      { type: 'debit', accountCode: '5101', amount: ctx.earnedInterest },
      { type: 'credit', accountCode: '2101', amount: totalPayout },
      { type: 'credit', accountCode: '4302', amount: ctx.penalty },
    ], { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postFDMaturityJournal(em: any, ctx: any) {
    const totalPayout = ctx.principal + ctx.interest;
    return this.postJournal(em, [
      { type: 'debit', accountCode: '2201', amount: ctx.principal },
      { type: 'debit', accountCode: '5101', amount: ctx.interest },
      { type: 'credit', accountCode: '2101', amount: totalPayout },
    ], { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postSavingsInterestPosting(em: any, ctx: any) {
    return this.postJournal(em, [
      { type: 'debit', accountCode: '2500', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount },
    ], { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postMobileMoneyJournal(em: any, ctx: any) {
    const entries = ctx.direction === 'inbound' ? [
      { type: 'debit', accountCode: '1202', amount: ctx.amount },
      { type: 'credit', accountCode: '2101', amount: ctx.amount },
    ] : [
      { type: 'debit', accountCode: '2101', amount: ctx.amount },
      { type: 'credit', accountCode: '1202', amount: ctx.amount },
    ];
    return this.postJournal(em, entries, { narration: ctx.narration, branchId: ctx.branchId });
  }

  async postManualJournal(dto: any, postedBy: string, branchId: string) {
    const entries = dto.entries.map((e: any) => ({
      type: e.type,
      accountCode: e.accountCode,
      amount: BigInt(Math.round(e.amount * 100)),
      narration: e.narration,
    }));
    if (!FinancialMath.validateJournal(entries)) {
      throw new BadRequestException('Journal entries must balance: sum(debits) must equal sum(credits)');
    }
    const journal = await this.postJournal(null, entries, {
      narration: dto.narration,
      branchId,
      postedBy,
    });
    await this.audit.log({
      actorUserId: postedBy,
      actorRole: 'accountant',
      actionType: 'MANUAL_JOURNAL_POSTED',
      entityType: 'journal',
      entityId: journal.journalId,
      afterValue: { journalNo: journal.journalNo, narration: dto.narration },
    });
    return journal;
  }

  async getJournal(journalId: string) {
    const journal = await this.journalRepo.findOne({ where: { journalId } });
    if (!journal) throw new NotFoundException('Journal not found');
    const entries = await this.ledgerRepo.find({ where: { journalId }, order: { entryType: 'ASC' } });
    return { journal, entries };
  }

  async listJournals(fromDate: string, toDate: string, page: number, limit: number) {
    const [data, total] = await this.journalRepo.findAndCount({
      where: {},
      order: { postingDate: 'DESC', createdAt: 'DESC' },
      skip: (page - 1) * limit,
      take: limit,
    });
    return { data, meta: { total, page, limit } };
  }

  async getAccountLedger(accountCode: string, fromDate: Date, toDate: Date) {
    return this.ledgerRepo.query(
      `SELECT le.*, j.journal_no, j.narration as journal_narration,
              j.posting_date, j.posted_by
       FROM ledger_entries le
       JOIN journal_entries j ON j.journal_id = le.journal_id
       WHERE le.account_code = $1 AND j.posting_date BETWEEN $2 AND $3
       ORDER BY j.posting_date ASC, le.created_at ASC`,
      [accountCode, fromDate, toDate]
    );
  }

  async getChartOfAccounts() {
    return this.dataSource.query(
      `SELECT * FROM chart_of_accounts WHERE is_active = true ORDER BY account_code`
    );
  }

  async getTrialBalance(date: Date, branchId?: string) {
    const branchFilter = branchId ? `AND le.branch_id = '${branchId}'` : '';
    return this.dataSource.query(
      `SELECT coa.account_code, coa.account_name, coa.account_class, coa.normal_balance,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) as total_debits,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) as total_credits
       FROM chart_of_accounts coa
       LEFT JOIN ledger_entries le ON le.account_code = coa.account_code ${branchFilter}
       LEFT JOIN journal_entries j ON j.journal_id = le.journal_id AND j.posting_date <= $1
       WHERE coa.is_active = true
       GROUP BY coa.account_code, coa.account_name, coa.account_class, coa.normal_balance
       ORDER BY coa.account_code`,
      [date]
    );
  }

  async getProfitAndLoss(fromDate: string, toDate: string) {
    return this.dataSource.query(
      `SELECT coa.account_code, coa.account_name, coa.account_class, coa.account_group,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) -
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) as net_balance
       FROM chart_of_accounts coa
       LEFT JOIN ledger_entries le ON le.account_code = coa.account_code
       LEFT JOIN journal_entries j ON j.journal_id = le.journal_id
         AND j.posting_date BETWEEN $1 AND $2
       WHERE coa.account_class IN ('income', 'expense')
       GROUP BY coa.account_code, coa.account_name, coa.account_class, coa.account_group
       ORDER BY coa.account_class, coa.account_code`,
      [fromDate, toDate]
    );
  }

  async getGLBalances(periodDate: string, branchId?: string) {
    const where = branchId ? `AND branch_id = '${branchId}'` : '';
    return this.dataSource.query(
      `SELECT * FROM gl_account_balances WHERE period_date = $1 ${where} ORDER BY account_code`,
      [periodDate]
    );
  }

  private async updateGLBalances(em: any, entries: any[], branchId: string) {
    const today = new Date().toISOString().split('T')[0];
    for (const entry of entries) {
      await em.query(
        `INSERT INTO gl_account_balances
          (balance_id, account_code, period_date, opening_balance, total_debits, total_credits, closing_balance, branch_id)
         VALUES ($1, $2, $3, 0, $4, $5, $4 - $5, $6)
         ON CONFLICT (account_code, period_date, branch_id) DO UPDATE SET
           total_debits = gl_account_balances.total_debits + $4,
           total_credits = gl_account_balances.total_credits + $5,
           closing_balance = gl_account_balances.closing_balance + ($4 - $5),
           updated_at = NOW()`,
        [
          uuid(), entry.accountCode, today,
          entry.type === 'debit' ? entry.amount.toString() : '0',
          entry.type === 'credit' ? entry.amount.toString() : '0',
          branchId || null,
        ]
      );
    }
  }

  private async generateJournalNo(): Promise<string> {
    const result = await this.dataSource.query(`SELECT generate_journal_no() as num`);
    return result[0].num;
  }
}
