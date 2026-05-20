import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { FixedDepositsService } from './fixed-deposits.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';

@ApiTags('fixed-deposits')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('fixed-deposits')
export class FixedDepositsController {
  constructor(private readonly svc: FixedDepositsService) {}

  @Post()
  @Roles('super_admin','admin','branch_manager','teller')
  place(@Body() dto: any, @CurrentUser('userId') userId: string) {
    return this.svc.place(dto, userId);
  }

  @Get()
  search(@Query() q: any) { return this.svc.search(q); }

  @Get(':fdId')
  findOne(@Param('fdId') fdId: string) { return this.svc.findById(fdId); }

  @Post(':fdId/liquidate')
  @Roles('super_admin','admin','branch_manager')
  liquidate(@Param('fdId') fdId: string, @Body('reason') reason: string, @CurrentUser('userId') userId: string) {
    return this.svc.earlyLiquidation(fdId, reason, userId);
  }

  @Post(':fdId/execute-liquidation')
  @Roles('super_admin','admin')
  executeLiquidation(@Param('fdId') fdId: string, @CurrentUser('userId') userId: string) {
    return this.svc.executeEarlyLiquidation(fdId, userId);
  }
}
