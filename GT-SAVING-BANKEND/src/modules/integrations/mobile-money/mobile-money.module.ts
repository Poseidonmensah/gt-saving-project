import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { MobileMoneyController } from './mobile-money.controller';
import { MobileMoneyService } from './mobile-money.service';
import { LedgerModule } from '../../ledger/ledger.module';
import { AuditModule } from '../../audit/audit.module';
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('mobile_money_transactions')
export class MobileMoneyTxnEntity {
  @PrimaryColumn({ name: 'mm_txn_id' }) mmTxnId: string;
  @Column({ name: 'internal_ref', unique: true }) internalRef: string;
  @Column({ name: 'provider' }) provider: string;
  @Column({ name: 'provider_ref', nullable: true }) providerRef: string;
  @Column({ name: 'wallet_number' }) walletNumber: string;
  @Column({ name: 'direction' }) direction: string;
  @Column({ name: 'amount', type: 'bigint' }) amount: bigint;
  @Column({ name: 'charges', type: 'bigint', default: 0 }) charges: bigint;
  @Column({ name: 'status', default: 'pending' }) status: string;
  @Column({ name: 'callback_received', default: false }) callbackReceived: boolean;
  @Column({ name: 'callback_data', type: 'jsonb', nullable: true }) callbackData: any;
  @Column({ name: 'retry_count', default: 0 }) retryCount: number;
  @Column({ name: 'linked_transaction_id', nullable: true }) linkedTransactionId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Module({
  imports: [TypeOrmModule.forFeature([MobileMoneyTxnEntity]), HttpModule, LedgerModule, AuditModule],
  controllers: [MobileMoneyController],
  providers: [MobileMoneyService],
  exports: [MobileMoneyService],
})
export class MobileMoneyModule {}
