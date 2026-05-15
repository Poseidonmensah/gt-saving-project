import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../audit/audit.service';
import { ReconciliationSessionEntity } from './reconciliation.module';

@Injectable()
export class ReconciliationService {
  private readonly logger = new Logger(ReconciliationService.name);

  constructor(
    @InjectRepository(ReconciliationSessionEntity) private sessionRepo: Repository<ReconciliationSessionEntity>,
    @InjectDataSource() private ds: DataSource,
    private audit: AuditService,
  ) {}

  async startSession(type: string, branchId: string, userId: string) {
    return this.sessionRepo.save(this.sessionRepo.create({
      sessionId: uuid(), sessionDate: new Date(),
      sessionType: type, branchId, status: 'in_progress', performedBy: userId,
    }));
  }

  async reconcileCash(sessionId: string, physicalCount: bigint, userId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [gl] = await this.ds.query(
      `SELECT COALESCE(SUM(CASE WHEN entry_type='debit' THEN amount ELSE -amount END),0) as balance
       FROM ledger_entries le JOIN journal_entries j ON j.journal_id=le.journal_id
       WHERE le.account_code='1102' AND j.posting_date=$1`, [today]
    );
    const systemBalance = BigInt(gl?.balance || 0);
    const variance      = physicalCount - systemBalance;

    await this.sessionRepo.update(sessionId, {
      systemTotal: systemBalance, externalTotal: physicalCount, variance,
      status: variance === 0n ? 'matched' : 'exception',
    });

    if (variance !== 0n) {
      await this.ds.query(
        `INSERT INTO reconciliation_exceptions(exception_id,session_id,exception_type,amount,description)
         VALUES($1,$2,'cash_variance',$3,$4)`,
        [uuid(), sessionId, variance.toString(), `Cash variance: system=${systemBalance} physical=${physicalCount}`]
      );
    }
    return { systemBalance: systemBalance.toString(), physicalCount: physicalCount.toString(), variance: variance.toString(), balanced: variance === 0n };
  }

  async reconcileGL(sessionId: string) {
    const today = new Date().toISOString().split('T')[0];
    const [r] = await this.ds.query(
      `SELECT SUM(CASE WHEN le.entry_type='debit' THEN le.amount ELSE 0 END) as dr,
              SUM(CASE WHEN le.entry_type='credit' THEN le.amount ELSE 0 END) as cr
       FROM ledger_entries le JOIN journal_entries j ON j.journal_id=le.journal_id
       WHERE j.posting_date=$1`, [today]
    );
    const dr = BigInt(r?.dr || 0); const cr = BigInt(r?.cr || 0);
    await this.sessionRepo.update(sessionId, {
      systemTotal: dr, externalTotal: cr, variance: dr - cr,
      status: dr === cr ? 'matched' : 'exception',
    });
    return { debits: dr.toString(), credits: cr.toString(), balanced: dr === cr };
  }

  async getExceptions(sessionId: string) {
    return this.ds.query(
      `SELECT * FROM reconciliation_exceptions WHERE session_id=$1 ORDER BY created_at DESC`, [sessionId]
    );
  }

  async resolveException(exceptionId: string, notes: string, userId: string) {
    await this.ds.query(
      `UPDATE reconciliation_exceptions SET resolution_status='resolved', resolved_by=$1, resolved_at=NOW() WHERE exception_id=$2`,
      [userId, exceptionId]
    );
    await this.audit.log({ actorUserId: userId, actorRole: 'accountant', actionType: 'RECON_EXCEPTION_RESOLVED', entityType: 'reconciliation_exception', entityId: exceptionId, description: notes });
  }

  async getSessions(query: any) {
    const qb = this.sessionRepo.createQueryBuilder('s');
    if (query.sessionType) qb.andWhere('s.session_type=:t', { t: query.sessionType });
    if (query.branchId)    qb.andWhere('s.branch_id=:b',    { b: query.branchId });
    if (query.fromDate)    qb.andWhere('s.session_date>=:f', { f: query.fromDate });
    if (query.toDate)      qb.andWhere('s.session_date<=:td',{ td: query.toDate });
    qb.orderBy('s.created_at','DESC').take(50);
    return qb.getMany();
  }
}
