// ============================================================
// src/modules/loans/loan.entity.ts
// ============================================================
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('loans')
export class LoanEntity {
  @PrimaryColumn({ name: 'loan_id' }) loanId: string;
  @Column({ name: 'loan_number', unique: true }) loanNumber: string;
  @Column({ name: 'customer_id' }) customerId: string;
  @Column({ name: 'product_code' }) productCode: string;
  @Column({ name: 'branch_id' }) branchId: string;
  @Column({ name: 'principal_amount', type: 'bigint' }) principalAmount: bigint;
  @Column({ name: 'approved_amount', type: 'bigint', nullable: true }) approvedAmount: bigint;
  @Column({ name: 'disbursed_amount', type: 'bigint', nullable: true }) disbursedAmount: bigint;
  @Column({ name: 'outstanding_principal', type: 'bigint', default: 0 }) outstandingPrincipal: bigint;
  @Column({ name: 'accrued_interest', type: 'bigint', default: 0 }) accruedInterest: bigint;
  @Column({ name: 'accrued_penalty', type: 'bigint', default: 0 }) accruedPenalty: bigint;
  @Column({ name: 'interest_rate_pa', type: 'decimal', precision: 10, scale: 6 }) interestRatePa: string;
  @Column({ name: 'interest_method' }) interestMethod: string;
  @Column({ name: 'tenor_months' }) tenorMonths: number;
  @Column({ name: 'repayment_frequency', default: 'monthly' }) repaymentFrequency: string;
  @Column({ name: 'grace_period_days', default: 0 }) gracePeriodDays: number;
  @Column({ name: 'purpose', nullable: true }) purpose: string;
  @Column({ name: 'source_of_repayment', nullable: true }) sourceOfRepayment: string;
  @Column({ name: 'collateral_reference', nullable: true }) collateralReference: string;
  @Column({ name: 'guarantor_reference', nullable: true }) guarantorReference: string;
  @Column({ name: 'risk_grade', nullable: true }) riskGrade: string;
  @Column({ name: 'credit_score', nullable: true }) creditScore: number;
  @Column({ name: 'status', default: 'draft' }) status: string;
  @Column({ name: 'disbursement_account_id', nullable: true }) disbursementAccountId: string;
  @Column({ name: 'disbursement_date', type: 'date', nullable: true }) disbursementDate: Date;
  @Column({ name: 'first_repayment_date', type: 'date', nullable: true }) firstRepaymentDate: Date;
  @Column({ name: 'maturity_date', type: 'date', nullable: true }) maturityDate: Date;
  @Column({ name: 'last_repayment_date', type: 'date', nullable: true }) lastRepaymentDate: Date;
  @Column({ name: 'days_in_arrears', default: 0 }) daysInArrears: number;
  @Column({ name: 'times_restructured', default: 0 }) timesRestructured: number;
  @Column({ name: 'write_off_amount', type: 'bigint', nullable: true }) writeOffAmount: bigint;
  @Column({ name: 'write_off_date', type: 'date', nullable: true }) writeOffDate: Date;
  @Column({ name: 'loan_officer_id', nullable: true }) loanOfficerId: string;
  @Column({ name: 'created_by' }) createdBy: string;
  @Column({ name: 'submitted_at', nullable: true }) submittedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('loan_repayment_schedules')
export class LoanRepaymentScheduleEntity {
  @PrimaryColumn({ name: 'schedule_id' }) scheduleId: string;
  @Column({ name: 'loan_id' }) loanId: string;
  @Column({ name: 'installment_no' }) installmentNo: number;
  @Column({ name: 'due_date', type: 'date' }) dueDate: Date;
  @Column({ name: 'opening_balance', type: 'bigint' }) openingBalance: bigint;
  @Column({ name: 'principal_due', type: 'bigint' }) principalDue: bigint;
  @Column({ name: 'interest_due', type: 'bigint' }) interestDue: bigint;
  @Column({ name: 'penalty_due', type: 'bigint', default: 0 }) penaltyDue: bigint;
  @Column({ name: 'total_due', type: 'bigint' }) totalDue: bigint;
  @Column({ name: 'amount_paid', type: 'bigint', default: 0 }) amountPaid: bigint;
  @Column({ name: 'principal_paid', type: 'bigint', default: 0 }) principalPaid: bigint;
  @Column({ name: 'interest_paid', type: 'bigint', default: 0 }) interestPaid: bigint;
  @Column({ name: 'penalty_paid', type: 'bigint', default: 0 }) penaltyPaid: bigint;
  @Column({ name: 'closing_balance', type: 'bigint' }) closingBalance: bigint;
  @Column({ name: 'payment_date', type: 'date', nullable: true }) paymentDate: Date;
  @Column({ name: 'status', default: 'scheduled' }) status: string;
}

// ============================================================
// src/modules/loans/loans.module.ts
// ============================================================
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LoansController } from './loans.controller';
import { LoansService } from './loans.service';
import { AccountsModule } from '../accounts/accounts.module';
import { TransactionsModule } from '../transactions/transactions.module';
import { LedgerModule } from '../ledger/ledger.module';
import { AuditModule } from '../audit/audit.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorkflowModule } from '../workflow/workflow.module';
import { FeesModule } from '../fees/fees.module';
import { CreditBureauModule } from '../integrations/credit-bureau/credit-bureau.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([LoanEntity, LoanRepaymentScheduleEntity]),
    AccountsModule, TransactionsModule, LedgerModule,
    AuditModule, NotificationsModule, WorkflowModule, FeesModule, CreditBureauModule,
  ],
  controllers: [LoansController],
  providers: [LoansService],
  exports: [LoansService, TypeOrmModule],
})
export class LoansModule {}

// ============================================================
// src/modules/loans/loans.service.ts
// ============================================================
import {
  Injectable, NotFoundException, BadRequestException,
  ForbiddenException, Logger, ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AccountsService } from '../accounts/accounts.service';
import { TransactionsService } from '../transactions/transactions.service';
import { LedgerService } from '../ledger/ledger.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WorkflowService } from '../workflow/workflow.service';
import { FeesService } from '../fees/fees.service';
import { CreditBureauService } from '../integrations/credit-bureau/credit-bureau.service';
import { FinancialMath, generateRef } from '../../common/utils/financial.util';
import { addMonths, addDays, differenceInDays, isAfter, isBefore } from 'date-fns';

@Injectable()
export class LoansService {
  private readonly logger = new Logger(LoansService.name);

  constructor(
    @InjectRepository(LoanEntity) private loanRepo: Repository<LoanEntity>,
    @InjectRepository(LoanRepaymentScheduleEntity) private scheduleRepo: Repository<LoanRepaymentScheduleEntity>,
    private dataSource: DataSource,
    private accountsService: AccountsService,
    private txnService: TransactionsService,
    private ledger: LedgerService,
    private audit: AuditService,
    private notifications: NotificationsService,
    private workflow: WorkflowService,
    private fees: FeesService,
    private creditBureau: CreditBureauService,
  ) {}

  // ─── APPLICATION SUBMISSION ──────────────────────────────
  async createApplication(dto: CreateLoanDto, officerId: string): Promise<LoanEntity> {
    // 1. Check customer status
    const customer = await this.loanRepo.manager.findOne('customers', {
      where: { customerId: dto.customerId }
    });
    if (!customer) throw new NotFoundException('Customer not found');
    if ((customer as any).kycStatus !== 'approved') {
      throw new ForbiddenException('Customer KYC must be approved before applying for a loan');
    }

    // 2. Check for active loans (max concurrent check)
    const product = await this.getProduct(dto.productCode);
    const activeLoans = await this.loanRepo.count({
      where: { customerId: dto.customerId, status: 'active' as any },
    });
    if (activeLoans >= product.maxConcurrentLoans) {
      throw new ConflictException(`Customer already has ${activeLoans} active loan(s). Maximum is ${product.maxConcurrentLoans}`);
    }

    // 3. Product eligibility check
    const requestedAmount = BigInt(dto.principalAmount);
    if (requestedAmount < BigInt(product.minAmount) || requestedAmount > BigInt(product.maxAmount)) {
      throw new BadRequestException(
        `Loan amount must be between ${FinancialMath.format(BigInt(product.minAmount))} and ${FinancialMath.format(BigInt(product.maxAmount))}`
      );
    }

    if (dto.tenorMonths < product.minTenorMonths || dto.tenorMonths > product.maxTenorMonths) {
      throw new BadRequestException(`Tenor must be between ${product.minTenorMonths} and ${product.maxTenorMonths} months`);
    }

    // 4. Generate loan number
    const loanNumber = await this.generateLoanNumber();

    const loan = this.loanRepo.create({
      loanId: uuid(),
      loanNumber,
      customerId: dto.customerId,
      productCode: dto.productCode,
      branchId: dto.branchId,
      principalAmount: requestedAmount,
      interestRatePa: product.interestRatePa,
      interestMethod: product.interestMethod,
      tenorMonths: dto.tenorMonths,
      repaymentFrequency: product.repaymentFreq,
      gracePeriodDays: product.gracePeriodDays,
      purpose: dto.purpose,
      sourceOfRepayment: dto.sourceOfRepayment,
      collateralReference: dto.collateralReference,
      guarantorReference: dto.guarantorReference,
      disbursementAccountId: dto.disbursementAccountId,
      loanOfficerId: officerId,
      createdBy: officerId,
      status: 'draft',
    });

    const saved = await this.loanRepo.save(loan);

    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'loan_officer',
      actionType: 'LOAN_APPLICATION_CREATED',
      entityType: 'loan',
      entityId: saved.loanId,
      afterValue: { loanNumber: saved.loanNumber, amount: saved.principalAmount.toString() },
    });

    return saved;
  }

  // ─── SUBMIT FOR REVIEW ───────────────────────────────────
  async submitForReview(loanId: string, officerId: string): Promise<LoanEntity> {
    const loan = await this.findById(loanId);
    if (loan.status !== 'draft') throw new BadRequestException('Only draft loans can be submitted');

    // Collateral/guarantor checks
    const product = await this.getProduct(loan.productCode);
    if (product.requiresCollateral && !loan.collateralReference) {
      throw new BadRequestException('Collateral documentation is required for this product');
    }
    if (product.requiresGuarantor && !loan.guarantorReference) {
      throw new BadRequestException('Guarantor information is required for this product');
    }

    // Credit bureau check
    try {
      const bureauData = await this.creditBureau.checkCustomer(loan.customerId);
      await this.loanRepo.update(loanId, {
        creditScore: bureauData.score,
        riskGrade: this.assignRiskGrade(bureauData.score),
        status: 'submitted',
        submittedAt: new Date(),
      });
    } catch {
      await this.loanRepo.update(loanId, { status: 'submitted', submittedAt: new Date() });
    }

    // Create approval workflow
    await this.workflow.createRequest({
      workflowType: 'loan_disbursement',
      entityType: 'loan',
      entityId: loanId,
      requestorId: officerId,
      amount: Number(loan.principalAmount),
    });

    await this.audit.log({
      actorUserId: officerId,
      actorRole: 'loan_officer',
      actionType: 'LOAN_SUBMITTED',
      entityType: 'loan',
      entityId: loanId,
    });

    return this.findById(loanId);
  }

  // ─── CREDIT ANALYSIS ─────────────────────────────────────
  async submitCreditAnalysis(loanId: string, dto: CreditAnalysisDto, analystId: string) {
    const loan = await this.findById(loanId);
    if (!['submitted', 'under_review'].includes(loan.status)) {
      throw new BadRequestException('Loan is not in a reviewable state');
    }

    await this.loanRepo.update(loanId, {
      creditScore: dto.creditScore,
      riskGrade: dto.riskGrade,
      approvedAmount: dto.recommendedAmount ? BigInt(dto.recommendedAmount) : loan.principalAmount,
      status: 'under_review',
    });

    await this.audit.log({
      actorUserId: analystId,
      actorRole: 'credit_analyst',
      actionType: 'CREDIT_ANALYSIS_SUBMITTED',
      entityType: 'loan',
      entityId: loanId,
      afterValue: dto,
    });

    return this.findById(loanId);
  }

  // ─── APPROVAL ────────────────────────────────────────────
  async approveLoan(loanId: string, approverId: string, approvedAmount?: number, conditions?: string) {
    const loan = await this.findById(loanId);

    // Self-approval prevention
    if (loan.createdBy === approverId || loan.loanOfficerId === approverId) {
      throw new ForbiddenException('You cannot approve a loan you submitted or initiated');
    }

    if (!['submitted', 'under_review'].includes(loan.status)) {
      throw new BadRequestException('Loan is not in an approvable state');
    }

    const finalAmount = approvedAmount ? BigInt(approvedAmount) : loan.principalAmount;

    await this.loanRepo.update(loanId, {
      approvedAmount: finalAmount,
      status: 'approved',
    });

    await this.audit.log({
      actorUserId: approverId,
      actorRole: 'branch_manager',
      actionType: 'LOAN_APPROVED',
      entityType: 'loan',
      entityId: loanId,
      afterValue: { approvedAmount: finalAmount.toString(), conditions },
    });

    // Notify customer
    const customer = await this.loanRepo.manager.findOne('customers', { where: { customerId: loan.customerId } });
    if (customer) {
      await this.notifications.sendSms(
        (customer as any).phoneNumber,
        `Dear ${(customer as any).fullName}, your loan application ${loan.loanNumber} for ${FinancialMath.format(finalAmount)} has been approved. Please visit us to proceed with disbursement.`
      );
    }

    return this.findById(loanId);
  }

  // ─── REJECT ──────────────────────────────────────────────
  async rejectLoan(loanId: string, rejectedBy: string, reason: string) {
    const loan = await this.findById(loanId);
    if (!['submitted', 'under_review', 'approved'].includes(loan.status)) {
      throw new BadRequestException('Loan cannot be rejected at this stage');
    }

    await this.loanRepo.update(loanId, { status: 'rejected' });
    await this.audit.log({
      actorUserId: rejectedBy,
      actorRole: 'branch_manager',
      actionType: 'LOAN_REJECTED',
      entityType: 'loan',
      entityId: loanId,
      reasonCode: reason,
    });

    return this.findById(loanId);
  }

  // ─── DISBURSEMENT ─────────────────────────────────────────
  async disburseLoan(loanId: string, disbursedBy: string): Promise<LoanEntity> {
    const loan = await this.findById(loanId);
    if (loan.status !== 'approved') throw new BadRequestException('Loan must be in approved state to disburse');
    if (!loan.disbursementAccountId) throw new BadRequestException('No disbursement account specified');

    const disbursementAccount = await this.accountsService.findById(loan.disbursementAccountId);
    if (disbursementAccount.status !== 'active') throw new BadRequestException('Disbursement account is not active');

    const amount = loan.approvedAmount || loan.principalAmount;

    // Calculate processing fee
    const product = await this.getProduct(loan.productCode);
    const processingFee = FinancialMath.calcFee(
      amount, 'percentage', undefined, product.processingFeeRate.toString()
    );
    const netDisbursement = amount - processingFee;

    const disbursementDate = new Date();
    const firstRepaymentDate = addDays(
      addMonths(disbursementDate, 1),
      loan.gracePeriodDays
    );
    const maturityDate = addMonths(firstRepaymentDate, loan.tenorMonths - 1);

    return await this.dataSource.transaction(async (em) => {
      // Credit disbursement account
      await this.accountsService.creditAccount(disbursementAccount.accountId, netDisbursement, em);

      // Create disbursement transaction
      const txnRef = generateRef('DIS');
      await em.query(
        `INSERT INTO transactions (transaction_id, transaction_ref, transaction_type, channel,
          dest_account_id, amount, fees, penalties, net_amount, narration, status, business_date,
          initiated_by, approved_by, approved_at, posted_at, branch_id)
         VALUES ($1,$2,'loan_disbursement','internal',$3,$4,$5,0,$6,$7,'posted',CURRENT_DATE,$8,$8,NOW(),NOW(),$9)`,
        [uuid(), txnRef, disbursementAccount.accountId, amount.toString(), processingFee.toString(),
         netDisbursement.toString(), `Loan disbursement - ${loan.loanNumber}`, disbursedBy, loan.branchId]
      );

      // Post fee income to GL
      await this.ledger.postLoanDisbursementJournal(em, {
        loanId,
        amount,
        processingFee,
        branchId: loan.branchId,
        narration: `Loan disbursement - ${loan.loanNumber}`,
      });

      // Generate repayment schedule
      const schedule = loan.interestMethod === 'flat'
        ? FinancialMath.generateFlatRateSchedule(amount, loan.interestRatePa, loan.tenorMonths, firstRepaymentDate)
        : FinancialMath.generateReducingBalanceSchedule(amount, loan.interestRatePa, loan.tenorMonths, disbursementDate, firstRepaymentDate, loan.gracePeriodDays);

      for (const s of schedule) {
        await em.query(
          `INSERT INTO loan_repayment_schedules
            (schedule_id, loan_id, installment_no, due_date, opening_balance,
             principal_due, interest_due, penalty_due, total_due, closing_balance, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,'scheduled')`,
          [uuid(), loanId, s.installmentNo, s.dueDate, s.openingBalance.toString(),
           s.principalDue.toString(), s.interestDue.toString(),
           (s.principalDue + s.interestDue).toString(), s.closingBalance.toString()]
        );
      }

      // Update loan status
      await em.update(LoanEntity, { loanId }, {
        status: 'active',
        disbursedAmount: amount,
        outstandingPrincipal: amount,
        disbursementDate,
        firstRepaymentDate,
        maturityDate,
      });

      await this.audit.log({
        actorUserId: disbursedBy,
        actorRole: 'admin',
        actionType: 'LOAN_DISBURSED',
        entityType: 'loan',
        entityId: loanId,
        afterValue: { amount: amount.toString(), date: disbursementDate },
      });

      return this.findById(loanId);
    });
  }

  // ─── REPAYMENT ────────────────────────────────────────────
  async recordRepayment(loanId: string, dto: RepaymentDto, recordedBy: string) {
    const loan = await this.findById(loanId);
    if (!['active', 'in_arrears'].includes(loan.status)) {
      throw new BadRequestException('Loan is not in a repayable state');
    }

    // Get next due installment
    const nextInstallment = await this.scheduleRepo.findOne({
      where: { loanId, status: 'scheduled' as any },
      order: { installmentNo: 'ASC' },
    });
    if (!nextInstallment) throw new BadRequestException('No outstanding installments found');

    const paymentAmount = BigInt(dto.amount);
    const sourceAccount = await this.accountsService.findById(dto.sourceAccountId);

    if (sourceAccount.availableBalance < paymentAmount) {
      throw new BadRequestException('Insufficient balance for repayment');
    }

    return await this.dataSource.transaction(async (em) => {
      // Debit source account
      await this.accountsService.debitAccount(dto.sourceAccountId, paymentAmount, em);

      // Allocate payment: penalty → interest → principal
      let remaining = paymentAmount;
      let penaltyPaid = 0n;
      let interestPaid = 0n;
      let principalPaid = 0n;

      // Pay penalty first
      if (nextInstallment.penaltyDue > 0n) {
        penaltyPaid = remaining >= nextInstallment.penaltyDue ? nextInstallment.penaltyDue : remaining;
        remaining -= penaltyPaid;
      }
      // Then interest
      if (remaining > 0n) {
        interestPaid = remaining >= nextInstallment.interestDue ? nextInstallment.interestDue : remaining;
        remaining -= interestPaid;
      }
      // Then principal
      if (remaining > 0n) {
        principalPaid = remaining >= nextInstallment.principalDue ? nextInstallment.principalDue : remaining;
        remaining -= principalPaid;
      }

      const totalPaid = penaltyPaid + interestPaid + principalPaid;
      const isPaidInFull = totalPaid >= nextInstallment.totalDue;

      // Update schedule
      await em.update(LoanRepaymentScheduleEntity, { scheduleId: nextInstallment.scheduleId }, {
        amountPaid: totalPaid,
        principalPaid,
        interestPaid,
        penaltyPaid,
        paymentDate: new Date(),
        status: isPaidInFull ? 'paid' : 'partial',
      });

      // Update loan outstanding
      const newOutstanding = loan.outstandingPrincipal - principalPaid;
      const isFullyRepaid = newOutstanding <= 0n;

      await em.update(LoanEntity, { loanId }, {
        outstandingPrincipal: isFullyRepaid ? 0n : newOutstanding,
        accrued_interest: loan.accruedInterest - interestPaid < 0n ? 0n : loan.accruedInterest - interestPaid,
        daysInArrears: 0,
        status: isFullyRepaid ? 'closed' : loan.status === 'in_arrears' ? 'active' : loan.status,
        lastRepaymentDate: new Date(),
      });

      // Create transaction record
      const txnRef = generateRef('REP');
      await em.query(
        `INSERT INTO transactions (transaction_id, transaction_ref, transaction_type, channel,
          source_account_id, amount, fees, penalties, net_amount, narration, status, business_date,
          initiated_by, approved_by, approved_at, posted_at, branch_id)
         VALUES ($1,$2,'loan_repayment','teller',$3,$4,0,$5,$6,$7,'posted',CURRENT_DATE,$8,$8,NOW(),NOW(),$9)`,
        [uuid(), txnRef, dto.sourceAccountId, paymentAmount.toString(), penaltyPaid.toString(),
         (paymentAmount - penaltyPaid).toString(), `Loan repayment - ${loan.loanNumber} Installment #${nextInstallment.installmentNo}`,
         recordedBy, loan.branchId]
      );

      // Post to GL
      await this.ledger.postLoanRepaymentJournal(em, {
        loanId,
        principalPaid,
        interestPaid,
        penaltyPaid,
        branchId: loan.branchId,
        narration: `Loan repayment - ${loan.loanNumber}`,
      });

      await this.audit.log({
        actorUserId: recordedBy,
        actorRole: 'teller',
        actionType: 'LOAN_REPAYMENT_POSTED',
        entityType: 'loan',
        entityId: loanId,
        afterValue: { installmentNo: nextInstallment.installmentNo, paid: paymentAmount.toString() },
      });

      if (isFullyRepaid) {
        await this.notifications.sendSms(
          (await this.loanRepo.manager.query(`SELECT phone_number FROM customers WHERE customer_id = $1`, [loan.customerId]))[0]?.phone_number,
          `Congratulations! Your loan ${loan.loanNumber} has been fully repaid. Thank you for banking with Good Time S&L.`
        );
      }

      return { success: true, installmentNo: nextInstallment.installmentNo, paid: totalPaid.toString(), isFullyRepaid };
    });
  }

  // ─── RESTRUCTURING ────────────────────────────────────────
  async restructureLoan(loanId: string, dto: RestructureDto, requestedBy: string) {
    const loan = await this.findById(loanId);
    if (!['active', 'in_arrears', 'default'].includes(loan.status)) {
      throw new BadRequestException('Loan cannot be restructured in its current state');
    }

    // Require workflow approval
    const req = await this.workflow.createRequest({
      workflowType: 'loan_restructure',
      entityType: 'loan',
      entityId: loanId,
      requestorId: requestedBy,
      amount: Number(loan.outstandingPrincipal),
      notes: dto.reason,
      metadata: dto,
    });

    await this.audit.log({
      actorUserId: requestedBy,
      actorRole: 'loan_officer',
      actionType: 'LOAN_RESTRUCTURE_REQUESTED',
      entityType: 'loan',
      entityId: loanId,
      afterValue: dto,
    });

    return { status: 'pending_approval', workflowRequestId: req.requestId };
  }

  async executeRestructure(loanId: string, dto: RestructureDto, approvedBy: string) {
    const loan = await this.findById(loanId);

    return await this.dataSource.transaction(async (em) => {
      // Cancel existing pending schedule entries
      await em.query(
        `UPDATE loan_repayment_schedules SET status = 'waived'
         WHERE loan_id = $1 AND status = 'scheduled'`,
        [loanId]
      );

      // Generate new schedule from outstanding balance
      const newSchedule = loan.interestMethod === 'flat'
        ? FinancialMath.generateFlatRateSchedule(
            loan.outstandingPrincipal,
            dto.newInterestRate || loan.interestRatePa,
            dto.newTenorMonths || loan.tenorMonths,
            dto.newFirstPaymentDate || addMonths(new Date(), 1),
          )
        : FinancialMath.generateReducingBalanceSchedule(
            loan.outstandingPrincipal,
            dto.newInterestRate || loan.interestRatePa,
            dto.newTenorMonths || loan.tenorMonths,
            new Date(),
            dto.newFirstPaymentDate || addMonths(new Date(), 1),
          );

      for (const s of newSchedule) {
        await em.query(
          `INSERT INTO loan_repayment_schedules
            (schedule_id, loan_id, installment_no, due_date, opening_balance,
             principal_due, interest_due, penalty_due, total_due, closing_balance, status)
           VALUES ($1,$2,$3,$4,$5,$6,$7,0,$8,$9,'scheduled')`,
          [uuid(), loanId, s.installmentNo, s.dueDate, s.openingBalance.toString(),
           s.principalDue.toString(), s.interestDue.toString(),
           (s.principalDue + s.interestDue).toString(), s.closingBalance.toString()]
        );
      }

      await em.update(LoanEntity, { loanId }, {
        status: 'restructured',
        timesRestructured: loan.timesRestructured + 1,
        daysInArrears: 0,
        interestRatePa: dto.newInterestRate || loan.interestRatePa,
        tenorMonths: dto.newTenorMonths || loan.tenorMonths,
        accruedPenalty: dto.waivedPenalty ? 0n : loan.accruedPenalty,
      });

      await this.audit.log({
        actorUserId: approvedBy,
        actorRole: 'admin',
        actionType: 'LOAN_RESTRUCTURED',
        entityType: 'loan',
        entityId: loanId,
        beforeValue: { status: loan.status, tenor: loan.tenorMonths },
        afterValue: dto,
        reasonCode: dto.reason,
      });
    });
  }

  // ─── DELINQUENCY BATCH (runs nightly) ────────────────────
  @Cron('0 1 * * *') // 1 AM daily
  async processDelinquency() {
    this.logger.log('Running delinquency check...');
    const today = new Date();

    // Find all overdue installments
    const overdueSchedules = await this.scheduleRepo.query(
      `SELECT s.*, l.accrued_penalty, l.outstanding_principal, l.product_code,
              lp.penalty_rate_pd, l.loan_id, l.customer_id, l.branch_id, l.loan_number
       FROM loan_repayment_schedules s
       JOIN loans l ON l.loan_id = s.loan_id
       JOIN loan_products lp ON lp.product_code = l.product_code
       WHERE s.due_date < $1 AND s.status IN ('scheduled','partial')
         AND l.status IN ('active','in_arrears')`,
      [today]
    );

    for (const row of overdueSchedules) {
      try {
        const daysOverdue = differenceInDays(today, new Date(row.due_date));
        const outstandingPrincipal = BigInt(row.outstanding_principal);
        const dailyPenalty = FinancialMath.calcDailyPenalty(
          outstandingPrincipal, row.penalty_rate_pd, 1
        );

        // Accumulate daily penalty
        await this.loanRepo.query(
          `UPDATE loans SET
            days_in_arrears = $1,
            accrued_penalty = accrued_penalty + $2,
            status = CASE WHEN $1 >= 90 THEN 'default' WHEN $1 >= 1 THEN 'in_arrears' ELSE status END
           WHERE loan_id = $3`,
          [daysOverdue, dailyPenalty.toString(), row.loan_id]
        );

        // Update schedule penalty
        await this.scheduleRepo.query(
          `UPDATE loan_repayment_schedules SET penalty_due = penalty_due + $1, total_due = total_due + $1
           WHERE schedule_id = $2`,
          [dailyPenalty.toString(), row.schedule_id]
        );

        // Send SMS reminder for first day overdue
        if (daysOverdue === 1) {
          const [customer] = await this.loanRepo.manager.query(
            `SELECT phone_number, full_name FROM customers WHERE customer_id = $1`, [row.customer_id]
          );
          if (customer) {
            await this.notifications.sendSms(
              customer.phone_number,
              `Dear ${customer.full_name}, your loan ${row.loan_number} repayment of ${FinancialMath.format(BigInt(row.total_due))} was due yesterday. Please make payment immediately to avoid further penalties. Call: 030-XXX-XXXX`
            );
          }
        }
      } catch (err) {
        this.logger.error(`Delinquency processing error for loan ${row.loan_id}: ${err.message}`);
      }
    }

    this.logger.log(`Delinquency check completed. Processed ${overdueSchedules.length} overdue schedules.`);
  }

  // ─── WRITE-OFF ────────────────────────────────────────────
  async writeOff(loanId: string, reason: string, approvedBy: string) {
    const loan = await this.findById(loanId);
    if (!['default', 'in_arrears'].includes(loan.status)) {
      throw new BadRequestException('Only defaulted or in-arrears loans can be written off');
    }

    const writeOffAmount = loan.outstandingPrincipal + loan.accruedInterest + loan.accruedPenalty;

    await this.dataSource.transaction(async (em) => {
      await em.update(LoanEntity, { loanId }, {
        status: 'written_off',
        writeOffAmount,
        writeOffDate: new Date(),
      });

      await this.ledger.postLoanWriteOffJournal(em, {
        loanId,
        principalAmount: loan.outstandingPrincipal,
        branchId: loan.branchId,
        narration: `Loan write-off - ${loan.loanNumber}`,
      });
    });

    await this.audit.log({
      actorUserId: approvedBy,
      actorRole: 'admin',
      actionType: 'LOAN_WRITTEN_OFF',
      entityType: 'loan',
      entityId: loanId,
      reasonCode: reason,
      afterValue: { writeOffAmount: writeOffAmount.toString() },
    });

    return this.findById(loanId);
  }

  // ─── QUERIES ─────────────────────────────────────────────
  async findById(loanId: string): Promise<LoanEntity> {
    const loan = await this.loanRepo.findOne({ where: { loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }

  async getRepaymentSchedule(loanId: string) {
    return this.scheduleRepo.find({ where: { loanId }, order: { installmentNo: 'ASC' } });
  }

  async search(query: LoanSearchDto) {
    const qb = this.loanRepo.createQueryBuilder('l')
      .leftJoinAndMapOne('l.customer', 'customers', 'c', 'c.customer_id = l.customer_id');

    if (query.customerId) qb.andWhere('l.customer_id = :c', { c: query.customerId });
    if (query.status) qb.andWhere('l.status = :s', { s: query.status });
    if (query.branchId) qb.andWhere('l.branch_id = :b', { b: query.branchId });
    if (query.loanNumber) qb.andWhere('l.loan_number ILIKE :ln', { ln: `%${query.loanNumber}%` });

    qb.orderBy('l.created_at', 'DESC')
      .skip(((query.page || 1) - 1) * (query.limit || 20))
      .take(query.limit || 20);

    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page: query.page || 1, limit: query.limit || 20 } };
  }

  async getPortfolioSummary(branchId?: string) {
    const where = branchId ? `WHERE l.branch_id = '${branchId}'` : '';
    const [result] = await this.loanRepo.query(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'active') as active_count,
        COUNT(*) FILTER (WHERE status = 'in_arrears') as arrears_count,
        COUNT(*) FILTER (WHERE status = 'default') as default_count,
        SUM(outstanding_principal) FILTER (WHERE status IN ('active','in_arrears','default')) as total_outstanding,
        SUM(outstanding_principal) FILTER (WHERE status = 'in_arrears') as arrears_outstanding,
        SUM(outstanding_principal) FILTER (WHERE status = 'default') as default_outstanding,
        SUM(accrued_interest) as total_accrued_interest,
        SUM(accrued_penalty) as total_accrued_penalty
       FROM loans l ${where}`
    );
    return result;
  }

  private assignRiskGrade(score: number): string {
    if (score >= 750) return 'A';
    if (score >= 650) return 'B';
    if (score >= 550) return 'C';
    if (score >= 450) return 'D';
    return 'E';
  }

  private async getProduct(productCode: string) {
    const [product] = await this.loanRepo.manager.query(
      `SELECT * FROM loan_products WHERE product_code = $1`, [productCode]
    );
    if (!product) throw new NotFoundException(`Loan product ${productCode} not found`);
    return product;
  }

  private async generateLoanNumber(): Promise<string> {
    const result = await this.loanRepo.manager.query(`SELECT generate_loan_number() as num`);
    return result[0].num;
  }
}

// ============================================================
// src/modules/loans/loans.controller.ts
// ============================================================
import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';
import { IsString, IsNumber, IsOptional, IsPositive, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

class CreateLoanDto {
  @IsString() customerId: string;
  @IsString() productCode: string;
  @IsString() branchId: string;
  @IsNumber() @IsPositive() principalAmount: number;
  @IsNumber() @IsPositive() tenorMonths: number;
  @IsOptional() @IsString() purpose?: string;
  @IsOptional() @IsString() sourceOfRepayment?: string;
  @IsOptional() @IsString() collateralReference?: string;
  @IsOptional() @IsString() guarantorReference?: string;
  @IsString() disbursementAccountId: string;
}

class CreditAnalysisDto {
  @IsNumber() creditScore: number;
  @IsString() riskGrade: string;
  @IsOptional() @IsNumber() recommendedAmount?: number;
  @IsOptional() @IsString() notes?: string;
}

class RepaymentDto {
  @IsString() sourceAccountId: string;
  @IsNumber() @IsPositive() amount: number;
  @IsOptional() @IsString() narration?: string;
}

class RestructureDto {
  @IsString() reason: string;
  @IsOptional() @IsString() newInterestRate?: string;
  @IsOptional() @IsNumber() newTenorMonths?: number;
  @IsOptional() @IsDateString() newFirstPaymentDate?: Date;
  @IsOptional() @IsBoolean() waivedPenalty?: boolean;
}

class LoanSearchDto {
  @IsOptional() @IsString() customerId?: string;
  @IsOptional() @IsString() status?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() loanNumber?: string;
  @IsOptional() @Type(() => Number) page?: number;
  @IsOptional() @Type(() => Number) limit?: number;
}

@ApiTags('loans')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('loans')
export class LoansController {
  constructor(private loansService: LoansService) {}

  @Post()
  @Roles('loan_officer','branch_manager','admin','super_admin')
  create(@Body() dto: CreateLoanDto, @CurrentUser('userId') userId: string) {
    return this.loansService.createApplication(dto, userId);
  }

  @Get() search(@Query() query: LoanSearchDto) { return this.loansService.search(query); }

  @Get('portfolio') portfolio(@Query('branchId') branchId?: string) { return this.loansService.getPortfolioSummary(branchId); }

  @Get(':loanId') findOne(@Param('loanId') loanId: string) { return this.loansService.findById(loanId); }

  @Get(':loanId/schedule') getSchedule(@Param('loanId') loanId: string) { return this.loansService.getRepaymentSchedule(loanId); }

  @Post(':loanId/submit')
  @Roles('loan_officer','branch_manager','admin','super_admin')
  submit(@Param('loanId') loanId: string, @CurrentUser('userId') userId: string) {
    return this.loansService.submitForReview(loanId, userId);
  }

  @Post(':loanId/credit-analysis')
  @Roles('credit_analyst','branch_manager','admin','super_admin')
  creditAnalysis(@Param('loanId') loanId: string, @Body() dto: CreditAnalysisDto, @CurrentUser('userId') userId: string) {
    return this.loansService.submitCreditAnalysis(loanId, dto, userId);
  }

  @Post(':loanId/approve')
  @Roles('branch_manager','admin','super_admin')
  approve(
    @Param('loanId') loanId: string,
    @Body() body: { approvedAmount?: number; conditions?: string },
    @CurrentUser('userId') userId: string,
  ) {
    return this.loansService.approveLoan(loanId, userId, body.approvedAmount, body.conditions);
  }

  @Post(':loanId/reject')
  @Roles('branch_manager','admin','super_admin')
  reject(@Param('loanId') loanId: string, @Body('reason') reason: string, @CurrentUser('userId') userId: string) {
    return this.loansService.rejectLoan(loanId, userId, reason);
  }

  @Post(':loanId/disburse')
  @Roles('admin','super_admin')
  disburse(@Param('loanId') loanId: string, @CurrentUser('userId') userId: string) {
    return this.loansService.disburseLoan(loanId, userId);
  }

  @Post(':loanId/repayment')
  @Roles('teller','branch_manager','admin','super_admin')
  repayment(@Param('loanId') loanId: string, @Body() dto: RepaymentDto, @CurrentUser('userId') userId: string) {
    return this.loansService.recordRepayment(loanId, dto, userId);
  }

  @Post(':loanId/restructure')
  @Roles('loan_officer','branch_manager','admin','super_admin')
  restructure(@Param('loanId') loanId: string, @Body() dto: RestructureDto, @CurrentUser('userId') userId: string) {
    return this.loansService.restructureLoan(loanId, dto, userId);
  }

  @Post(':loanId/write-off')
  @Roles('admin','super_admin')
  writeOff(@Param('loanId') loanId: string, @Body('reason') reason: string, @CurrentUser('userId') userId: string) {
    return this.loansService.writeOff(loanId, reason, userId);
  }
}
