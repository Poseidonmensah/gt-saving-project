import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { addHours } from 'date-fns';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron } from '@nestjs/schedule';
import { WorkflowRequestEntity, WorkflowActionEntity } from './workflow.module';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(
    @InjectRepository(WorkflowRequestEntity) private reqRepo: Repository<WorkflowRequestEntity>,
    @InjectRepository(WorkflowActionEntity)  private actRepo: Repository<WorkflowActionEntity>,
    private eventEmitter: EventEmitter2,
  ) {}

  async createRequest(dto: {
    workflowType: string; entityType: string; entityId: string;
    requestorId: string; amount?: number; notes?: string; metadata?: any;
  }): Promise<WorkflowRequestEntity> {
    const matrix = await this.getMatrix(dto.workflowType, dto.amount || 0);
    const roles  = [matrix?.required_role_1, matrix?.required_role_2, matrix?.required_role_3].filter(Boolean);
    const steps  = roles.length || 1;
    const slaHrs = matrix?.sla_hours || 24;

    const req = this.reqRepo.create({
      requestId:          uuid(),
      requestRef:         `WF${Date.now().toString(36).toUpperCase()}`,
      workflowType:       dto.workflowType,
      entityType:         dto.entityType,
      entityId:           dto.entityId,
      amount:             dto.amount ? BigInt(dto.amount) : undefined,
      requestorId:        dto.requestorId,
      currentApproverRole: roles[0] || 'branch_manager',
      currentStep:        1,
      totalSteps:         steps,
      status:             steps === 0 ? 'approved' : 'pending',
      slaDeadline:        addHours(new Date(), slaHrs),
      notes:              dto.notes,
      metadata:           dto.metadata,
    });
    const saved = await this.reqRepo.save(req);
    this.eventEmitter.emit('workflow.created', saved);
    return saved;
  }

  async processAction(requestId: string, actorId: string, actorRole: string, action: string, notes?: string, ip?: string) {
    const req = await this.reqRepo.findOne({ where: { requestId } });
    if (!req) throw new NotFoundException('Workflow request not found');
    if (['approved','rejected'].includes(req.status)) throw new BadRequestException(`Request already ${req.status}`);
    if (req.requestorId === actorId) throw new ForbiddenException('You cannot approve your own request');
    if (req.currentApproverRole && req.currentApproverRole !== actorRole)
      throw new ForbiddenException(`Requires role: ${req.currentApproverRole}`);

    await this.actRepo.save(this.actRepo.create({
      actionId: uuid(), requestId, stepNo: req.currentStep,
      action, actorId, actorRole, notes, ipAddress: ip,
    }));

    let newStatus = req.status;
    let completedAt: Date | null = null;

    if (action === 'approve') {
      if (req.currentStep >= req.totalSteps) {
        newStatus = 'approved'; completedAt = new Date();
      } else {
        const matrix = await this.getMatrix(req.workflowType, Number(req.amount));
        const roles  = [matrix?.required_role_1, matrix?.required_role_2, matrix?.required_role_3].filter(Boolean);
        await this.reqRepo.update(requestId, {
          currentStep: req.currentStep + 1,
          currentApproverRole: roles[req.currentStep] || null,
        });
        return this.reqRepo.findOne({ where: { requestId } });
      }
    } else if (action === 'reject')   { newStatus = 'rejected'; completedAt = new Date(); }
      else if (action === 'escalate') { newStatus = 'escalated'; }

    await this.reqRepo.update(requestId, { status: newStatus as any, completedAt: completedAt ?? undefined });

    if (newStatus === 'approved') this.eventEmitter.emit(`workflow.approved.${req.workflowType}`, { request: req, actorId });
    if (newStatus === 'rejected') this.eventEmitter.emit(`workflow.rejected.${req.workflowType}`, { request: req, actorId, notes });

    return this.reqRepo.findOne({ where: { requestId } });
  }

  async getPending(role: string) {
    return this.reqRepo.find({
      where: { status: 'pending' as any, currentApproverRole: role },
      order: { priority: 'ASC', createdAt: 'ASC' },
    });
  }

  async getAll(query: any) {
    const qb = this.reqRepo.createQueryBuilder('w');
    if (query.status)       qb.andWhere('w.status = :s', { s: query.status });
    if (query.workflowType) qb.andWhere('w.workflow_type = :wt', { wt: query.workflowType });
    if (query.requestorId)  qb.andWhere('w.requestor_id = :r', { r: query.requestorId });
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    qb.orderBy('w.created_at','DESC').skip((page-1)*limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }

  async getById(requestId: string) {
    const req = await this.reqRepo.findOne({ where: { requestId } });
    if (!req) throw new NotFoundException('Request not found');
    const actions = await this.actRepo.find({ where: { requestId }, order: { createdAt: 'ASC' } });
    return { request: req, actions };
  }

  @Cron('0 * * * *')
  async checkSlaEscalations() {
    const overdue = await this.reqRepo.query(
      `SELECT * FROM workflow_requests WHERE status='pending' AND sla_deadline < NOW() AND escalated_at IS NULL`
    );
    for (const r of overdue) {
      await this.reqRepo.update(r.request_id, { status: 'escalated' as any, escalatedAt: new Date() });
      this.eventEmitter.emit('workflow.sla_breached', r);
    }
    if (overdue.length) this.logger.warn(`${overdue.length} workflow(s) SLA-breached and escalated`);
  }

  private async getMatrix(workflowType: string, amount: number) {
    const [m] = await this.reqRepo.manager.query(
      `SELECT * FROM approval_matrix WHERE workflow_type=$1 AND is_active=true
       AND min_amount<=$2 AND (max_amount IS NULL OR max_amount>=$2)
       ORDER BY min_amount DESC LIMIT 1`,
      [workflowType, amount]
    );
    return m;
  }
}
