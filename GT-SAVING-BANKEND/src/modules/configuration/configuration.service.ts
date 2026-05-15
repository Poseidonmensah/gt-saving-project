import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ConfigurationService {
  constructor(@InjectDataSource() private ds: DataSource, private audit: AuditService) {}

  getProducts()      { return this.ds.query(`SELECT * FROM product_configs ORDER BY product_type, product_code`); }
  getLoanProducts()  { return this.ds.query(`SELECT * FROM loan_products ORDER BY product_code`); }
  getFees()          { return this.ds.query(`SELECT * FROM fee_configs WHERE is_active=true ORDER BY product_code, fee_code`); }
  getMatrix()        { return this.ds.query(`SELECT * FROM approval_matrix WHERE is_active=true ORDER BY workflow_type, min_amount`); }
  getBranches()      { return this.ds.query(`SELECT * FROM branches ORDER BY branch_code`); }
  getCalendar()      { return this.ds.query(`SELECT * FROM business_calendar ORDER BY calendar_date`); }

  async updateProduct(code: string, dto: any, userId: string, role: string) {
    const [existing] = await this.ds.query(`SELECT * FROM product_configs WHERE product_code=$1`, [code]);
    if (!existing) throw new NotFoundException(`Product ${code} not found`);
    const sets: string[] = [];
    const vals: any[]    = [];
    let i = 1;
    if (dto.interestRatePa !== undefined) { sets.push(`interest_rate_pa=$${i++}`); vals.push(dto.interestRatePa); }
    if (dto.minimumBalance !== undefined) { sets.push(`minimum_balance=$${i++}`); vals.push(dto.minimumBalance); }
    if (dto.maxDailyWithdrawal !== undefined) { sets.push(`max_daily_withdrawal=$${i++}`); vals.push(dto.maxDailyWithdrawal); }
    if (dto.isActive !== undefined) { sets.push(`is_active=$${i++}`); vals.push(dto.isActive); }
    if (!sets.length) return existing;
    vals.push(code);
    await this.ds.query(`UPDATE product_configs SET ${sets.join(',')} WHERE product_code=$${i}`, vals);
    await this.audit.log({ actorUserId: userId, actorRole: role, actionType: 'PRODUCT_CONFIG_UPDATED', entityType: 'product_config', entityId: code, beforeValue: existing, afterValue: dto });
    const [updated] = await this.ds.query(`SELECT * FROM product_configs WHERE product_code=$1`, [code]);
    return updated;
  }

  async createBranch(dto: any, userId: string) {
    const { v4: uuid } = require('uuid');
    const [b] = await this.ds.query(
      `INSERT INTO branches(branch_id,branch_code,branch_name,region,address,phone,email,status)
       VALUES($1,$2,$3,$4,$5,$6,$7,'active') RETURNING *`,
      [uuid(), dto.branchCode, dto.branchName, dto.region, dto.address, dto.phone, dto.email]
    );
    await this.audit.log({ actorUserId: userId, actorRole: 'admin', actionType: 'BRANCH_CREATED', entityType: 'branch', entityId: b.branch_id, afterValue: b });
    return b;
  }
}
