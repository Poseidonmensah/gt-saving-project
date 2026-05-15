import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReconciliationController } from './reconciliation.controller';
import { ReconciliationService } from './reconciliation.service';
import { AuditModule } from '../audit/audit.module';
import { LedgerModule } from '../ledger/ledger.module';
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('reconciliation_sessions')
export class ReconciliationSessionEntity {
  @PrimaryColumn({ name: 'session_id' }) sessionId: string;
  @Column({ name: 'session_date', type:'date' }) sessionDate: Date;
  @Column({ name: 'session_type' }) sessionType: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @Column({ name: 'status', default: 'in_progress' }) status: string;
  @Column({ name: 'system_total', type:'bigint', nullable: true }) systemTotal: bigint;
  @Column({ name: 'external_total', type:'bigint', nullable: true }) externalTotal: bigint;
  @Column({ name: 'variance', type:'bigint', nullable: true }) variance: bigint;
  @Column({ name: 'matched_count', default: 0 }) matchedCount: number;
  @Column({ name: 'exception_count', default: 0 }) exceptionCount: number;
  @Column({ name: 'performed_by' }) performedBy: string;
  @Column({ name: 'reviewed_by', nullable: true }) reviewedBy: string;
  @Column({ name: 'completed_at', nullable: true }) completedAt: Date;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Module({
  imports: [TypeOrmModule.forFeature([ReconciliationSessionEntity]), AuditModule, LedgerModule],
  controllers: [ReconciliationController],
  providers: [ReconciliationService],
  exports: [ReconciliationService, TypeOrmModule],
})
export class ReconciliationModule {}
