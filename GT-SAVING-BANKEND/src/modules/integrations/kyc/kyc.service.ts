// ============================================================
// KYC INTEGRATION SERVICE
// src/modules/integrations/kyc/kyc.service.ts
// ============================================================
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

interface KycScreeningInput {
  fullName: string;
  dateOfBirth?: Date;
  idNumber?: string;
  nationality?: string;
}

interface KycScreeningResult {
  pepMatch: boolean;
  sanctionsMatch: boolean;
  matchScore: number;
  matchDetails: any[];
  provider: string;
  screenedAt: Date;
}

@Injectable()
export class KycService {
  private readonly logger = new Logger(KycService.name);

  constructor(private config: ConfigService) {}

  async screenCustomer(input: KycScreeningInput): Promise<KycScreeningResult> {
    try {
      const apiKey = this.config.get('KYC_API_KEY');
      const apiUrl = this.config.get('KYC_PROVIDER_URL');

      if (!apiKey || !apiUrl) {
        this.logger.warn('KYC provider not configured — using manual fallback');
        return this.manualFallback(input);
      }

      const response = await axios.post(
        `${apiUrl}/v1/screen`,
        {
          name: input.fullName,
          dob: input.dateOfBirth?.toISOString().split('T')[0],
          id_number: input.idNumber,
          nationality: input.nationality || 'GH',
          lists: ['pep', 'sanctions', 'adverse_media'],
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
            'X-Institution-ID': 'GTL001',
          },
          timeout: 10000,
        }
      );

      const data = response.data;
      return {
        pepMatch: data.pep_hit === true,
        sanctionsMatch: data.sanctions_hit === true,
        matchScore: data.match_score || 0,
        matchDetails: data.matches || [],
        provider: 'kyc_provider',
        screenedAt: new Date(),
      };
    } catch (err) {
      this.logger.error(`KYC screening failed: ${err.message}`);
      // Fail open for network errors — flag for manual review
      return {
        pepMatch: false,
        sanctionsMatch: false,
        matchScore: 0,
        matchDetails: [{ note: 'Screening failed — manual review required', error: err.message }],
        provider: 'fallback',
        screenedAt: new Date(),
      };
    }
  }

  async verifyDocument(documentType: string, documentNumber: string, dateOfBirth?: Date): Promise<{
    verified: boolean;
    name?: string;
    details?: any;
  }> {
    try {
      const apiKey = this.config.get('KYC_API_KEY');
      const apiUrl = this.config.get('KYC_PROVIDER_URL');

      if (!apiKey) return { verified: false, details: { note: 'KYC provider not configured' } };

      const response = await axios.post(
        `${apiUrl}/v1/verify-document`,
        {
          document_type: documentType,
          document_number: documentNumber,
          date_of_birth: dateOfBirth?.toISOString().split('T')[0],
          country: 'GH',
        },
        {
          headers: { 'Authorization': `Bearer ${apiKey}` },
          timeout: 15000,
        }
      );

      return {
        verified: response.data.verified === true,
        name: response.data.full_name,
        details: response.data,
      };
    } catch (err) {
      this.logger.error(`Document verification failed: ${err.message}`);
      return { verified: false, details: { error: err.message } };
    }
  }

  private manualFallback(input: KycScreeningInput): KycScreeningResult {
    // Internal basic name matching against known watchlists (for offline/fallback)
    const KNOWN_FLAGGED = ['test sanctioned', 'demo pep']; // Replace with real watchlist source
    const nameLower = input.fullName.toLowerCase();
    const pepMatch = KNOWN_FLAGGED.some(f => nameLower.includes(f) && f.includes('pep'));
    const sanctionsMatch = KNOWN_FLAGGED.some(f => nameLower.includes(f) && f.includes('sanctioned'));

    return { pepMatch, sanctionsMatch, matchScore: 0, matchDetails: [], provider: 'internal_fallback', screenedAt: new Date() };
  }
}

// ============================================================
// CREDIT BUREAU SERVICE
// src/modules/integrations/credit-bureau/credit-bureau.service.ts
// ============================================================
@Injectable()
export class CreditBureauService {
  private readonly logger = new Logger(CreditBureauService.name);

  constructor(private config: ConfigService) {}

  async checkCustomer(customerId: string): Promise<{
    score: number;
    grade: string;
    delinquencyCount: number;
    totalExposure: number;
    details: any;
  }> {
    try {
      const apiKey = this.config.get('CREDIT_BUREAU_API_KEY');
      const apiUrl = this.config.get('CREDIT_BUREAU_URL');
      const institutionId = this.config.get('CREDIT_BUREAU_INSTITUTION_ID');

      if (!apiKey) {
        this.logger.warn('Credit bureau not configured — using default score');
        return { score: 600, grade: 'C', delinquencyCount: 0, totalExposure: 0, details: { note: 'Manual assessment required' } };
      }

      // Get customer ID details first
      const response = await axios.post(
        `${apiUrl}/v1/inquiry`,
        {
          customer_id: customerId,
          institution_id: institutionId,
          inquiry_type: 'credit_report',
          consent: true,
        },
        {
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      const bureau = response.data;
      const score = bureau.credit_score || 600;
      const grade = this.scoreToGrade(score);

      return {
        score,
        grade,
        delinquencyCount: bureau.delinquency_count || 0,
        totalExposure: bureau.total_exposure || 0,
        details: bureau,
      };
    } catch (err) {
      this.logger.error(`Credit bureau inquiry failed: ${err.message}`);
      // Return neutral score on failure — flag for manual review
      return {
        score: 580,
        grade: 'C',
        delinquencyCount: 0,
        totalExposure: 0,
        details: { error: err.message, note: 'Bureau unavailable — manual review required' },
      };
    }
  }

  async reportRepayment(loanId: string, customerId: string, amountPaid: number, onTime: boolean): Promise<void> {
    try {
      const apiKey = this.config.get('CREDIT_BUREAU_API_KEY');
      if (!apiKey) return;

      await axios.post(
        `${this.config.get('CREDIT_BUREAU_URL')}/v1/report`,
        {
          loan_reference: loanId,
          customer_id: customerId,
          amount_paid: amountPaid / 100, // Convert pesewas to GHS
          payment_on_time: onTime,
          report_date: new Date().toISOString().split('T')[0],
          institution_id: this.config.get('CREDIT_BUREAU_INSTITUTION_ID'),
        },
        { headers: { 'Authorization': `Bearer ${apiKey}` }, timeout: 10000 }
      );
    } catch (err) {
      this.logger.error(`Credit bureau reporting failed: ${err.message}`);
      // Non-blocking — log and continue
    }
  }

  private scoreToGrade(score: number): string {
    if (score >= 750) return 'A';
    if (score >= 650) return 'B';
    if (score >= 550) return 'C';
    if (score >= 450) return 'D';
    return 'E';
  }
}

// ============================================================
// END-OF-DAY BATCH PROCESSOR
// src/modules/batch/end-of-day.service.ts
// ============================================================
@Injectable()
export class EndOfDayService {
  private readonly logger = new Logger('EndOfDay');

  constructor(
    private dataSource: DataSource,
    private ledger: LedgerService,
    private reconciliation: ReconciliationService,
    private audit: AuditService,
    private notifications: NotificationsService,
  ) {}

  // Runs at 11:59 PM daily
  @Cron('59 23 * * *')
  async runEndOfDay() {
    this.logger.log('═══════════════════════════════');
    this.logger.log('Starting End-of-Day Processing');
    this.logger.log('═══════════════════════════════');
    const startTime = Date.now();
    const today = new Date().toISOString().split('T')[0];
    const systemUserId = '00000000-0000-0000-0000-000000000010';

    try {
      // Step 1: Seal business day — prevent backdated postings
      await this.sealBusinessDay(today);
      this.logger.log('✓ Step 1: Business day sealed');

      // Step 2: Verify all teller drawers are closed
      const openDrawers = await this.dataSource.query(
        `SELECT d.*, u.full_name FROM teller_drawers d JOIN users u ON u.user_id = d.teller_user_id
         WHERE d.business_date = $1 AND d.status = 'open'`, [today]
      );
      if (openDrawers.length > 0) {
        this.logger.warn(`⚠️ ${openDrawers.length} teller drawer(s) still open — auto-closing`);
        for (const drawer of openDrawers) {
          await this.dataSource.query(
            `UPDATE teller_drawers SET status = 'closed', closed_at = NOW() WHERE drawer_id = $1`,
            [drawer.drawer_id]
          );
          // Notify branch manager
          this.logger.warn(`Auto-closed drawer for ${drawer.full_name}`);
        }
      }
      this.logger.log('✓ Step 2: Teller drawers verified');

      // Step 3: GL sub-ledger reconciliation
      const [glCheck] = await this.dataSource.query(
        `SELECT
          SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END) as total_debits,
          SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END) as total_credits,
          SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END) =
          SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END) as is_balanced
         FROM ledger_entries le
         JOIN journal_entries j ON j.journal_id = le.journal_id
         WHERE j.posting_date = $1`, [today]
      );

      if (!glCheck.is_balanced) {
        this.logger.error(`❌ CRITICAL: GL is UNBALANCED — Debits: ${glCheck.total_debits}, Credits: ${glCheck.total_credits}`);
        // Alert operations team
        await this.notifications.sendEmail(
          'operations@goodtimeloans.com.gh',
          '🚨 CRITICAL: GL Imbalance Detected',
          `The General Ledger is UNBALANCED for ${today}.\nDebits: GHS ${Number(glCheck.total_debits) / 100}\nCredits: GHS ${Number(glCheck.total_credits) / 100}\nImmediate investigation required.`
        );
      } else {
        this.logger.log(`✓ Step 3: GL balanced — DR = CR = GHS ${(Number(glCheck.total_debits) / 100).toFixed(2)}`);
      }

      // Step 4: Account dormancy check
      const dormancyUpdated = await this.dataSource.query(
        `UPDATE accounts SET status = 'dormant'
         WHERE status = 'active'
           AND last_transaction_at IS NOT NULL
           AND last_transaction_at < NOW() - INTERVAL '180 days'
           AND account_type IN ('savings','current')
         RETURNING account_id`
      );
      this.logger.log(`✓ Step 4: ${dormancyUpdated.length} accounts marked dormant`);

      // Step 5: Generate end-of-day summary report
      const [summary] = await this.dataSource.query(
        `SELECT
          COUNT(*) FILTER (WHERE transaction_type = 'deposit') as deposit_count,
          SUM(amount) FILTER (WHERE transaction_type = 'deposit') as deposit_total,
          COUNT(*) FILTER (WHERE transaction_type = 'withdrawal') as withdrawal_count,
          SUM(amount) FILTER (WHERE transaction_type = 'withdrawal') as withdrawal_total,
          COUNT(*) FILTER (WHERE transaction_type = 'loan_repayment') as repayment_count,
          COUNT(*) FILTER (WHERE status = 'pending') as pending_count
         FROM transactions WHERE business_date = $1`, [today]
      );

      this.logger.log(`✓ Step 5: Summary — Deposits: ${summary.deposit_count} | Withdrawals: ${summary.withdrawal_count} | Repayments: ${summary.repayment_count} | Pending: ${summary.pending_count}`);

      // Step 6: Update loan delinquency days
      await this.dataSource.query(
        `UPDATE loans SET days_in_arrears = (
          SELECT COALESCE(MAX(DATE_PART('day', NOW() - s.due_date)), 0)
          FROM loan_repayment_schedules s
          WHERE s.loan_id = loans.loan_id AND s.status IN ('scheduled','partial') AND s.due_date < CURRENT_DATE
        ) WHERE status IN ('active', 'in_arrears', 'default')`
      );
      this.logger.log('✓ Step 6: Loan delinquency days updated');

      // Step 7: Close accounting period
      const [period] = await this.dataSource.query(
        `SELECT * FROM accounting_periods WHERE period_date = $1`, [today]
      );
      if (period && period.status === 'open') {
        await this.dataSource.query(
          `UPDATE accounting_periods SET status = 'closed', closed_at = NOW() WHERE period_date = $1`, [today]
        );
      } else {
        await this.dataSource.query(
          `INSERT INTO accounting_periods (period_id, period_date, period_month, period_year, status, closed_at)
           VALUES ($1, $2, $3, $4, 'closed', NOW())
           ON CONFLICT (period_date) DO UPDATE SET status = 'closed', closed_at = NOW()`,
          [uuid(), today, new Date().getMonth() + 1, new Date().getFullYear()]
        );
      }
      this.logger.log('✓ Step 7: Accounting period closed');

      // Step 8: Open next business day period
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const tomorrowStr = tomorrow.toISOString().split('T')[0];
      await this.dataSource.query(
        `INSERT INTO accounting_periods (period_id, period_date, period_month, period_year, status)
         VALUES ($1, $2, $3, $4, 'open')
         ON CONFLICT (period_date) DO NOTHING`,
        [uuid(), tomorrowStr, tomorrow.getMonth() + 1, tomorrow.getFullYear()]
      );
      this.logger.log(`✓ Step 8: Period opened for ${tomorrowStr}`);

      const duration = ((Date.now() - startTime) / 1000).toFixed(1);
      this.logger.log(`═══════════════════════════════`);
      this.logger.log(`End-of-Day COMPLETE in ${duration}s`);
      this.logger.log(`═══════════════════════════════`);

      await this.audit.log({
        actorUserId: systemUserId,
        actorRole: 'system',
        actionType: 'END_OF_DAY_COMPLETE',
        entityType: 'system',
        entityId: today,
        afterValue: { summary, glBalanced: glCheck.is_balanced, duration },
      });
    } catch (err) {
      this.logger.error(`End-of-Day FAILED: ${err.message}`, err.stack);
      await this.notifications.sendEmail(
        'operations@goodtimeloans.com.gh',
        `🚨 End-of-Day Processing FAILED — ${today}`,
        `Error: ${err.message}\n\nPlease investigate immediately.`
      );
      await this.audit.log({
        actorUserId: systemUserId,
        actorRole: 'system',
        actionType: 'END_OF_DAY_FAILED',
        entityType: 'system',
        entityId: today,
        afterValue: { error: err.message },
      });
    }
  }

  private async sealBusinessDay(date: string) {
    // Mark period as closing to prevent new postings to this date
    await this.dataSource.query(
      `INSERT INTO accounting_periods (period_id, period_date, period_month, period_year, status)
       VALUES ($1, $2, $3, $4, 'closing')
       ON CONFLICT (period_date) DO UPDATE SET status = 'closing'`,
      [uuid(), date, new Date().getMonth() + 1, new Date().getFullYear()]
    );
  }
}

// ============================================================
// CONFIGURATION MODULE
// src/modules/configuration/configuration.service.ts
// ============================================================
@Injectable()
export class ConfigurationService {
  constructor(private dataSource: DataSource, private audit: AuditService) {}

  async getProductConfigs() {
    return this.dataSource.query(`SELECT * FROM product_configs WHERE is_active = true ORDER BY product_type, product_code`);
  }

  async updateProductConfig(productCode: string, updates: any, updatedBy: string, updatedByRole: string) {
    const [existing] = await this.dataSource.query(`SELECT * FROM product_configs WHERE product_code = $1`, [productCode]);
    if (!existing) throw new NotFoundException(`Product ${productCode} not found`);

    await this.dataSource.query(
      `UPDATE product_configs SET interest_rate_pa = COALESCE($1, interest_rate_pa),
        minimum_balance = COALESCE($2, minimum_balance),
        max_daily_withdrawal = COALESCE($3, max_daily_withdrawal),
        updated_at = NOW()
       WHERE product_code = $4`,
      [updates.interestRatePa, updates.minimumBalance, updates.maxDailyWithdrawal, productCode]
    );

    await this.audit.log({
      actorUserId: updatedBy,
      actorRole: updatedByRole,
      actionType: 'PRODUCT_CONFIG_UPDATED',
      entityType: 'product_config',
      entityId: productCode,
      beforeValue: existing,
      afterValue: updates,
    });
  }

  async getFeeConfigs() {
    return this.dataSource.query(`SELECT * FROM fee_configs WHERE is_active = true ORDER BY product_code, fee_code`);
  }

  async getApprovalMatrix() {
    return this.dataSource.query(`SELECT * FROM approval_matrix WHERE is_active = true ORDER BY workflow_type, min_amount`);
  }

  async getBranches() {
    return this.dataSource.query(`SELECT * FROM branches ORDER BY branch_code`);
  }
}

// Stub imports needed above
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { Cron } from '@nestjs/schedule';
import { v4 as uuid } from 'uuid';
