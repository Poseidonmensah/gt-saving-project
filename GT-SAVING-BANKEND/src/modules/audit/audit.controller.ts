import { Controller, Get, Query, UseGuards, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { AuditService } from './audit.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';

@ApiTags('audit')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('super_admin', 'admin', 'auditor', 'compliance_officer', 'branch_manager')
  search(@Query() query: any) {
    return this.auditService.search(query);
  }

  @Get('export')
  @Roles('super_admin', 'admin', 'auditor', 'compliance_officer')
  async export(@Query() query: any, @Res() res: Response) {
    const result = await this.auditService.search({ ...query, limit: 10000 });
    const rows = (result.data as any[]).map((r: any) => [
      r.createdAt, r.actorUserId, r.actorRole, r.actionType,
      r.entityType, r.entityId, r.description || '', r.ipAddress || '',
    ]);
    const csv = [
      ['Timestamp','Actor ID','Role','Action','Entity Type','Entity ID','Description','IP'],
      ...rows,
    ].map(r => r.join(',')).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit_export_${Date.now()}.csv"`);
    res.send(csv);
  }
}
