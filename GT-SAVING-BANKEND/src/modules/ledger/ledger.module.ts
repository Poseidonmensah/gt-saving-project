import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LedgerController } from './ledger.controller';
import { LedgerService } from './ledger.service';
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

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
  @Column({ name: 'is_reversal', default: false }) isReversal: boolean;
  @Column({ name: 'reversal_of', nullable: true }) reversalOf: string;
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

@Module({
  imports: [TypeOrmModule.forFeature([JournalEntryEntity, LedgerEntryEntity])],
  controllers: [LedgerController],
  providers: [LedgerService],
  exports: [LedgerService, TypeOrmModule],
})
export class LedgerModule {}
