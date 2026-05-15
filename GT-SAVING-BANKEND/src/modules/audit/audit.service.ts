import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AuditLogEntity } from './audit.module';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async log(dto: {
    actorUserId: string; actorRole?: string; actionType: string;
    entityType: string; entityId?: string; beforeValue?: any; afterValue?: any;
    reasonCode?: string; description?: string; ipAddress?: string;
    deviceFingerprint?: string; branchId?: string;
  }): Promise<void> {
    try {
      await this.repo.save(this.repo.create({
        auditId: uuid(),
        actorUserId: dto.actorUserId,
        actorRole: dto.actorRole || 'system',
        actionType: dto.actionType,
        entityType: dto.entityType,
        entityId: dto.entityId?.toString(),
        beforeValue: dto.beforeValue,
        afterValue: dto.afterValue,
        reasonCode: dto.reasonCode,
        description: dto.description,
        ipAddress: dto.ipAddress,
        deviceFingerprint: dto.deviceFingerprint,
        branchId: dto.branchId,
      }));
    } catch (err) {
      console.error('Audit log error (non-blocking):', err.message);
    }
  }

  async search(query: any) {
    const qb = this.repo.createQueryBuilder('a');
    if (query.actorUserId) qb.andWhere('a.actor_user_id = :u', { u: query.actorUserId });
    if (query.actionType)  qb.andWhere('a.action_type = :at', { at: query.actionType });
    if (query.entityType)  qb.andWhere('a.entity_type = :et', { et: query.entityType });
    if (query.entityId)    qb.andWhere('a.entity_id = :eid', { eid: query.entityId });
    if (query.fromDate)    qb.andWhere('a.created_at >= :fd', { fd: query.fromDate });
    if (query.toDate)      qb.andWhere('a.created_at <= :td', { td: query.toDate });
    const page  = parseInt(query.page  || '1');
    const limit = parseInt(query.limit || '50');
    qb.orderBy('a.created_at', 'DESC').skip((page - 1) * limit).take(limit);
    const [data, total] = await qb.getManyAndCount();
    return { data, meta: { total, page, limit } };
  }
}
