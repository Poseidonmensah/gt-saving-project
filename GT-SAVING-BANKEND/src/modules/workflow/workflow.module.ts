import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowController } from './workflow.controller';
import { WorkflowService } from './workflow.service';
import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('workflow_requests')
export class WorkflowRequestEntity {
  @PrimaryColumn({ name: 'request_id' }) requestId: string;
  @Column({ name: 'request_ref', unique: true }) requestRef: string;
  @Column({ name: 'workflow_type' }) workflowType: string;
  @Column({ name: 'entity_type' }) entityType: string;
  @Column({ name: 'entity_id' }) entityId: string;
  @Column({ name: 'amount', type: 'bigint', nullable: true }) amount: bigint;
  @Column({ name: 'requestor_id' }) requestorId: string;
  @Column({ name: 'current_approver_role', nullable: true }) currentApproverRole: string;
  @Column({ name: 'current_step', default: 1 }) currentStep: number;
  @Column({ name: 'total_steps', default: 1 }) totalSteps: number;
  @Column({ name: 'status', default: 'pending' }) status: string;
  @Column({ name: 'priority', default: 5 }) priority: number;
  @Column({ name: 'sla_deadline', nullable: true }) slaDeadline: Date;
  @Column({ name: 'escalated_at', nullable: true }) escalatedAt: Date;
  @Column({ name: 'completed_at', nullable: true }) completedAt: Date;
  @Column({ name: 'notes', nullable: true }) notes: string;
  @Column({ name: 'metadata', type: 'jsonb', nullable: true }) metadata: any;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at' }) updatedAt: Date;
}

@Entity('workflow_actions')
export class WorkflowActionEntity {
  @PrimaryColumn({ name: 'action_id' }) actionId: string;
  @Column({ name: 'request_id' }) requestId: string;
  @Column({ name: 'step_no' }) stepNo: number;
  @Column({ name: 'action' }) action: string;
  @Column({ name: 'actor_id' }) actorId: string;
  @Column({ name: 'actor_role' }) actorRole: string;
  @Column({ name: 'notes', nullable: true }) notes: string;
  @Column({ name: 'ip_address', nullable: true }) ipAddress: string;
  @CreateDateColumn({ name: 'created_at' }) createdAt: Date;
}

@Module({
  imports: [TypeOrmModule.forFeature([WorkflowRequestEntity, WorkflowActionEntity])],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService, TypeOrmModule],
})
export class WorkflowModule {}
