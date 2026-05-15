import { Injectable, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class EndOfDayService {
  private readonly logger = new Logger('EndOfDay');
  private readonly SYS_USER = '00000000-0000-0000-0000-000000000010';

  constructor(
    @InjectDataSource() private ds: DataSource,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  @Cron('59 23 * * *')
  async runEndOfDay() {
    this.logger.log('═══ Starting End-of-Day Processing ═══');
    const start = Date.now();
    const today = new Date().toISOString().split('T')[0];

    try {
      // Step 1: Seal day
      await this.ds.query(
        `INSERT INTO accounting_periods(period_id,period_date,period_month,period_year,status)
         VALUES($1,$2,$3,$4,'closing')
         ON CONFLICT(period_date) DO UPDATE SET status='closing'`,
        [uuid(), today, new Date().getMonth()+1, new Date().getFullYear()]
      );
      this.logger.log('✓ Step 1: Business day sealed');

      // Step 2: Auto-close open teller drawers
      const openDrawers = await this.ds.query(
        `UPDATE teller_drawers SET status='closed', closed_at=NOW() WHERE business_date=$1 AND status='open' RETURNING *`,
        [today]
      );
      if (openDrawers.length) this.logger.warn(`⚠ Auto-closed ${openDrawers.length} open drawer(s)`);
      this.logger.log('✓ Step 2: Teller drawers verified');

      // Step 3: GL balance check
      const [glCheck] = await this.ds.query(
        `SELECT
           SUM(CASE WHEN le.entry_type='debit'  THEN le.amount ELSE 0 END) as dr,
           SUM(CASE WHEN le.entry_type='credit' THEN le.amount ELSE 0 END) as cr
         FROM ledger_entries le
         JOIN journal_entries j ON j.journal_id=le.journal_id
         WHERE j.posting_date=$1`, [today]
      );
      const balanced = BigInt(glCheck?.dr||0) === BigInt(glCheck?.cr||0);
      if (!balanced) {
        await this.notifications.sendEmail('operations@goodtimeloans.com.gh',
          `🚨 GL IMBALANCE — ${today}`,
          `DR=${glCheck.dr} CR=${glCheck.cr}\nImmediate investigation required.`
        );
        this.logger.error(`❌ GL UNBALANCED: DR=${glCheck.dr} CR=${glCheck.cr}`);
      } else {
        this.logger.log(`✓ Step 3: GL balanced — ${(Number(glCheck.dr)/100).toLocaleString()} GHS`);
      }

      // Step 4: Mark dormant accounts
      const dormant = await this.ds.query(
        `UPDATE accounts SET status='dormant'
         WHERE status='active' AND account_type IN ('savings','current')
           AND last_transaction_at IS NOT NULL
           AND last_transaction_at < NOW() - INTERVAL '180 days'
         RETURNING account_id`
      );
      this.logger.log(`✓ Step 4: ${dormant.length} accounts marked dormant`);

      // Step 5: Update loan delinquency
      await this.ds.query(
        `UPDATE loans SET days_in_arrears=(
           SELECT COALESCE(MAX(EXTRACT(DAY FROM NOW()-s.due_date)::INT),0)
           FROM loan_repayment_schedules s
           WHERE s.loan_id=loans.loan_id AND s.status IN ('scheduled','partial') AND s.due_date<CURRENT_DATE
         ) WHERE status IN ('active','in_arrears','default')`
      );
      this.logger.log('✓ Step 5: Loan delinquency updated');

      // Step 6: Close period and open tomorrow
      await this.ds.query(
        `UPDATE accounting_periods SET status='closed', closed_at=NOW() WHERE period_date=$1`, [today]
      );
      const tom = new Date(); tom.setDate(tom.getDate()+1);
      const tomStr = tom.toISOString().split('T')[0];
      await this.ds.query(
        `INSERT INTO accounting_periods(period_id,period_date,period_month,period_year,status)
         VALUES($1,$2,$3,$4,'open') ON CONFLICT(period_date) DO NOTHING`,
        [uuid(), tomStr, tom.getMonth()+1, tom.getFullYear()]
      );
      this.logger.log(`✓ Step 6: Periods closed/opened`);

      const dur = ((Date.now()-start)/1000).toFixed(1);
      this.logger.log(`═══ End-of-Day COMPLETE in ${dur}s ═══`);

      await this.audit.log({
        actorUserId: this.SYS_USER, actorRole: 'system',
        actionType: 'END_OF_DAY_COMPLETE', entityType: 'system', entityId: today,
        afterValue: { glBalanced: balanced, dormantUpdated: dormant.length, duration: dur },
      });
    } catch (err) {
      this.logger.error(`End-of-Day FAILED: ${err.message}`, err.stack);
      await this.notifications.sendEmail('operations@goodtimeloans.com.gh',
        `🚨 EOD FAILED — ${today}`, `Error: ${err.message}`
      );
    }
  }
}
