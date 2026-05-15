import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

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
