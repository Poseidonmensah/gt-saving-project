import { Controller, Get, Query, Param, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query('branchId') branchId?: string) {
    return this.reportsService.getDashboardSummary(branchId);
  }

  @Get('generate/:type')
  @Roles('admin','super_admin')
  async generate(
    @Param('type') type: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('branchId') branchId: string,
    @Query('format') format: 'pdf' | 'excel' | 'csv' = 'excel',
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.generateReport(type, { fromDate, toDate, branchId }, format, userId);
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('trial-balance')
  trialBalance(@Query('fromDate') fromDate: string, @Query('toDate') toDate: string, @Query('branchId') branchId?: string) {
    return this.reportsService.trialBalance({ fromDate, toDate, branchId });
  }
}