import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('accounts')
export class AccountEntity {
  @PrimaryColumn({ name: 'account_id' }) accountId!: string;
  @Column({ name: 'account_number', unique: true }) accountNumber!: string;
  @Column({ name: 'customer_id', nullable: true }) customerId?: string;
  @Column({ name: 'product_code' }) productCode!: string;
  @Column({ name: 'account_type' }) accountType!: string;
  @Column({ name: 'branch_id' }) branchId!: string;
  @Column({ name: 'currency', default: 'GHS' }) currency!: string;
  @Column({ name: 'opening_balance', type: 'bigint', default: 0 }) openingBalance!: bigint;
  @Column({ name: 'current_balance', type: 'bigint', default: 0 }) currentBalance!: bigint;
  @Column({ name: 'available_balance', type: 'bigint', default: 0 }) availableBalance!: bigint;
  @Column({ name: 'hold_amount', type: 'bigint', default: 0 }) holdAmount!: bigint;
  @Column({ name: 'accrued_interest', type: 'bigint', default: 0 }) accruedInterest!: bigint;
  @Column({ name: 'status', default: 'pending' }) status!: string;
  @Column({ name: 'opened_at', type: 'date', nullable: true }) openedAt?: Date;
  @Column({ name: 'last_transaction_at', nullable: true }) lastTransactionAt?: Date;
  @Column({ name: 'dormancy_notified', default: false }) dormancyNotified!: boolean;
  @Column({ name: 'closed_at', type: 'date', nullable: true }) closedAt?: Date;
  @Column({ name: 'close_reason', nullable: true }) closeReason?: string;
  @Column({ name: 'mandate_type', default: 'single' }) mandateType!: string;
  @Column({ name: 'created_by' }) createdBy!: string;
  @Column({ name: 'approved_by', nullable: true }) approvedBy?: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt!: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt!: Date;
}