import { Controller, Get, Post, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { TellerService } from './teller.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles, CurrentUser } from '../../common/decorators';

@ApiTags('teller')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('teller')
export class TellerController {
  constructor(private readonly svc: TellerService) {}

  @Post('drawer/open')
  @Roles('teller','branch_manager','admin','super_admin')
  openDrawer(@Body('openingBalance') openingBalance: number, @CurrentUser() u: any) {
    return this.svc.openDrawer(u.userId, u.branchId, openingBalance);
  }

  @Post('drawer/close')
  @Roles('teller','branch_manager','admin','super_admin')
  closeDrawer(@Body('physicalCount') physicalCount: number, @CurrentUser() u: any) {
    return this.svc.closeDrawer(u.userId, u.branchId, physicalCount);
  }

  @Get('drawer/summary')
  @Roles('teller','branch_manager','admin','super_admin')
  getDrawerSummary(@CurrentUser() u: any) {
    return this.svc.getDrawerSummary(u.userId);
  }

  @Get('drawer/all')
  @Roles('branch_manager','admin','super_admin','accountant')
  getAllDrawers(@CurrentUser() u: any, @Query('date') date?: string) {
    return this.svc.getAllDrawers(u.branchId, date || new Date().toISOString().split('T')[0]);
  }
}
