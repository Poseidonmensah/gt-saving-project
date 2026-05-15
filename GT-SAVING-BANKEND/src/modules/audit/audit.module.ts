import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { Entity, PrimaryColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLogEntity {
  @PrimaryColumn({ name: 'audit_id' }) auditId: string;
  @Column({ name: 'actor_user_id' }) actorUserId: string;
  @Column({ name: 'actor_role' }) actorRole: string;
  @Column({ name: 'action_type' }) actionType: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id', nullable: true }) entityId: string;
  @Column({ name: 'before_value', type: 'jsonb', nullable: true }) beforeValue: any;
  @Column({ name: 'after_value', type: 'jsonb', nullable: true }) afterValue: any;
  @Column({ name: 'reason_code', nullable: true }) reasonCode: string;
  @Column({ name: 'description', nullable: true }) description: string;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @Column({ name: 'device_fingerprint', nullable: true }) deviceFingerprint: string;
  @Column({ name: 'user_agent', nullable: true }) userAgent: string;
  @Column({ name: 'session_id', nullable: true }) sessionId: string;
  @Column({ name: 'branch_id', nullable: true }) branchId: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Module({
  imports: [TypeOrmModule.forFeature([AuditLogEntity])],
  controllers: [AuditController],
  providers: [AuditService],
  exports: [AuditService, TypeOrmModule],
})
export class AuditModule {}
