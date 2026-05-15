import { Injectable, NotFoundException, ConflictException, Logger } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class TellerService {
  private readonly logger = new Logger(TellerService.name);

  constructor(
    @InjectDataSource() private ds: DataSource,
    private audit: AuditService,
  ) {}

  async openDrawer(tellerId: string, branchId: string, openingBalance: number) {
    const today = new Date().toISOString().split('T')[0];
    const existing = await this.ds.query(
      `SELECT * FROM teller_drawers WHERE teller_user_id=$1 AND business_date=$2`,
      [tellerId, today]
    );
    if (existing.length) throw new ConflictException('Drawer already opened for today');

    const [drawer] = await this.ds.query(
      `INSERT INTO teller_drawers(drawer_id,teller_user_id,branch_id,business_date,opening_balance,closing_balance,status,opened_at)
       VALUES($1,$2,$3,$4,$5,$5,'open',NOW()) RETURNING *`,
      [uuid(), tellerId, branchId, today, openingBalance.toString()]
    );
    await this.audit.log({ actorUserId: tellerId, actorRole: 'teller', actionType: 'DRAWER_OPENED', entityType: 'drawer', entityId: drawer.drawer_id, afterValue: { openingBalance } });
    return drawer;
  }

  async closeDrawer(tellerId: string, branchId: string, physicalCount: number) {
    const today = new Date().toISOString().split('T')[0];
    const [drawer] = await this.ds.query(
      `SELECT * FROM teller_drawers WHERE teller_user_id=$1 AND business_date=$2 AND status='open'`,
      [tellerId, today]
    );
    if (!drawer) throw new NotFoundException('No open drawer found for today');

    const systemBalance = Number(drawer.closing_balance ?? drawer.opening_balance);
    const variance = physicalCount - systemBalance;

    await this.ds.query(
      `UPDATE teller_drawers SET status='closed', closed_at=NOW(), closing_balance=$1 WHERE drawer_id=$2`,
      [physicalCount.toString(), drawer.drawer_id]
    );
    await this.audit.log({
      actorUserId: tellerId, actorRole: 'teller', actionType: 'DRAWER_CLOSED',
      entityType: 'drawer', entityId: drawer.drawer_id,
      afterValue: { systemBalance, physicalCount, variance },
    });
    return { systemBalance, physicalCount, variance, balanced: variance === 0 };
  }

  async getDrawerSummary(tellerId: string) {
    const today = new Date().toISOString().split('T')[0];
    const rows = await this.ds.query(
      `SELECT d.*,
         COUNT(t.transaction_id) FILTER (WHERE t.status='posted') as transaction_count,
         COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type='deposit' AND t.status='posted'),0) as total_deposits,
         COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type='withdrawal' AND t.status='posted'),0) as total_withdrawals,
         COALESCE(SUM(t.fees) FILTER (WHERE t.status='posted'),0) as total_fees
       FROM teller_drawers d
       LEFT JOIN transactions t ON t.drawer_id=d.drawer_id
       WHERE d.teller_user_id=$1 AND d.business_date=$2
       GROUP BY d.drawer_id`,
      [tellerId, today]
    );
    return rows[0] || null;
  }

  async getAllDrawers(branchId: string, date: string) {
    return this.ds.query(
      `SELECT d.*, u.full_name as teller_name,
         COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type='deposit' AND t.status='posted'),0) as total_deposits,
         COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_type='withdrawal' AND t.status='posted'),0) as total_withdrawals
       FROM teller_drawers d
       JOIN users u ON u.user_id=d.teller_user_id
       LEFT JOIN transactions t ON t.drawer_id=d.drawer_id
       WHERE d.branch_id=$1 AND d.business_date=$2
       GROUP BY d.drawer_id, u.full_name
       ORDER BY u.full_name`,
      [branchId, date]
    );
  }
}
