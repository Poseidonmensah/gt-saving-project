import { Controller, Get, Param, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';

const REPORT_ROLES = ['super_admin','admin','branch_manager','accountant','auditor','compliance_officer'];

@ApiTags('reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query('branchId') branchId?: string) {
    return this.svc.getDashboardSummary(branchId);
  }

  @Get('trial-balance')
  @Roles(...REPORT_ROLES)
  trialBalance(@Query('fromDate') from: string, @Query('toDate') to: string, @Query('branchId') b?: string) {
    return this.svc.trialBalance({ fromDate: from, toDate: to, branchId: b });
  }

  @Get('loan-portfolio')
  @Roles(...REPORT_ROLES)
  loanPortfolio(@Query('branchId') b?: string) {
    return this.svc.loanPortfolio({ fromDate: '', toDate: '', branchId: b });
  }

  @Get('arrears-aging')
  @Roles(...REPORT_ROLES)
  arrearsAging(@Query('branchId') b?: string) {
    return this.svc.arrearsAging({ fromDate: '', toDate: '', branchId: b });
  }

  @Get('disbursements')
  @Roles(...REPORT_ROLES)
  disbursements(@Query('fromDate') from: string, @Query('toDate') to: string, @Query('branchId') b?: string) {
    return this.svc.disbursementReport({ fromDate: from, toDate: to, branchId: b });
  }

  @Get('teller-collections')
  @Roles(...REPORT_ROLES)
  tellerCollections(@Query('fromDate') from: string, @Query('toDate') to: string, @Query('branchId') b?: string) {
    return this.svc.tellerCollections({ fromDate: from, toDate: to, branchId: b });
  }

  @Get('cash-position')
  @Roles(...REPORT_ROLES)
  cashPosition(@Query('date') date: string) {
    return this.svc.cashPosition({ fromDate: date, toDate: date });
  }

  @Get('deposit-growth')
  @Roles(...REPORT_ROLES)
  depositGrowth(@Query('fromDate') from: string, @Query('toDate') to: string) {
    return this.svc.depositGrowth({ fromDate: from, toDate: to });
  }

  @Get('kyc-status')
  @Roles('super_admin','admin','compliance_officer','auditor')
  kycStatus(@Query('fromDate') from: string, @Query('toDate') to: string, @Query('branchId') b?: string) {
    return this.svc.kycStatus({ fromDate: from, toDate: to, branchId: b });
  }

  @Get('high-value-transactions')
  @Roles('super_admin','admin','compliance_officer','auditor')
  highValue(@Query('fromDate') from: string, @Query('toDate') to: string) {
    return this.svc.highValueTransactions({ fromDate: from, toDate: to });
  }

  @Get('generate/:type')
  @Roles(...REPORT_ROLES)
  async generate(
    @Param('type') type: string,
    @Query('fromDate') from: string,
    @Query('toDate') to: string,
    @Query('branchId') branchId: string,
    @Query('format') format: 'pdf' | 'excel' | 'csv' = 'excel',
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const result = await this.svc.generateReport(type, { fromDate: from, toDate: to, branchId }, format, userId);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }
}
