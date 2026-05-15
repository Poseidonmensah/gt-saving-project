import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuid } from 'uuid';
import { LedgerService } from '../ledger/ledger.service';
import { FinancialMath } from '../../common/utils/financial.util';

@Injectable()
export class InterestEngineService {
  private readonly logger = new Logger('InterestEngine');

  constructor(
    @InjectDataSource() private ds: DataSource,
    private ledger: LedgerService,
  ) {}

  @Cron('0 23 * * *')
  async accrualDailySavingsInterest() {
    this.logger.log('Running daily savings interest accrual...');
    const today = new Date().toISOString().split('T')[0];
    const daysInYear = new Date().getFullYear() % 4 === 0 ? 366 : 365;

    const accounts = await this.ds.query(
      `SELECT a.account_id, a.current_balance, a.product_code, p.interest_rate_pa
       FROM accounts a
       JOIN product_configs p ON p.product_code=a.product_code
       WHERE a.status='active' AND a.account_type='savings'
         AND a.current_balance>0 AND p.interest_rate_pa>0
         AND NOT EXISTS(SELECT 1 FROM interest_accruals i WHERE i.account_id=a.account_id AND i.accrual_date=$1)`,
      [today]
    );

    let processed = 0;
    for (const acct of accounts) {
      try {
        const interest = FinancialMath.calcDailyInterest(BigInt(acct.current_balance), acct.interest_rate_pa, 1, daysInYear);
        if (interest > 0n) {
          await this.ds.query(
            `INSERT INTO interest_accruals(accrual_id,accrual_date,account_id,product_code,balance_snapshot,rate_applied,days,accrued_amount)
             VALUES($1,$2,$3,$4,$5,$6,1,$7)`,
            [uuid(), today, acct.account_id, acct.product_code, acct.current_balance, acct.interest_rate_pa, interest.toString()]
          );
          await this.ds.query(
            `UPDATE accounts SET accrued_interest=accrued_interest+$1 WHERE account_id=$2`,
            [interest.toString(), acct.account_id]
          );
          processed++;
        }
      } catch (e) { this.logger.error(`Accrual error ${acct.account_id}: ${e.message}`); }
    }
    this.logger.log(`Savings accrual done — ${processed} accounts`);
  }

  @Cron('0 2 1 * *')
  async postMonthlyInterest() {
    this.logger.log('Posting monthly savings interest...');
    const now   = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
    const end   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

    const rows = await this.ds.query(
      `SELECT account_id, SUM(accrued_amount) as total, product_code
       FROM interest_accruals
       WHERE accrual_date BETWEEN $1 AND $2 AND posted_to_journal=false AND account_id IS NOT NULL
       GROUP BY account_id, product_code`,
      [start, end]
    );

    for (const row of rows) {
      try {
        await this.ds.transaction(async em => {
          const total = BigInt(row.total);
          await em.query(
            `UPDATE accounts SET current_balance=current_balance+$1, available_balance=available_balance+$1, accrued_interest=accrued_interest-$1 WHERE account_id=$2`,
            [total.toString(), row.account_id]
          );
          const journal = await this.ledger.postSavingsInterestPosting(em, {
            amount: total, branchId: null,
            narration: `Monthly interest posting — ${start.slice(0,7)}`,
          });
          await em.query(
            `UPDATE interest_accruals SET posted_to_journal=true, journal_id=$1
             WHERE account_id=$2 AND accrual_date BETWEEN $3 AND $4`,
            [journal.journalId, row.account_id, start, end]
          );
        });
      } catch (e) { this.logger.error(`Monthly interest posting error ${row.account_id}: ${e.message}`); }
    }
    this.logger.log('Monthly interest posting complete');
  }

  @Cron('0 23 * * *')
  async accrualFDInterest() {
    const today = new Date().toISOString().split('T')[0];
    const fds = await this.ds.query(
      `SELECT fd.fd_id, fd.principal_amount, fd.interest_rate_pa, fd.product_code
       FROM fixed_deposits fd
       WHERE fd.status='active' AND fd.maturity_date>=CURRENT_DATE
         AND NOT EXISTS(SELECT 1 FROM interest_accruals i WHERE i.fd_id=fd.fd_id AND i.accrual_date=$1)`,
      [today]
    );
    for (const fd of fds) {
      const interest = FinancialMath.calcDailyInterest(BigInt(fd.principal_amount), fd.interest_rate_pa, 1, 365);
      await this.ds.query(
        `INSERT INTO interest_accruals(accrual_id,accrual_date,fd_id,product_code,balance_snapshot,rate_applied,days,accrued_amount)
         VALUES($1,$2,$3,$4,$5,$6,1,$7)`,
        [uuid(), today, fd.fd_id, fd.product_code, fd.principal_amount, fd.interest_rate_pa, interest.toString()]
      );
      await this.ds.query(
        `UPDATE fixed_deposits SET accrued_interest=accrued_interest+$1 WHERE fd_id=$2`,
        [interest.toString(), fd.fd_id]
      );
    }
  }
}
