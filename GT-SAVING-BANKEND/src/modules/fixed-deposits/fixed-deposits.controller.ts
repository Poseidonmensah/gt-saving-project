import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { FixedDepositsService } from './fixed-deposits.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('fixed-deposits')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('fixed-deposits')
export class FixedDepositsController {
  constructor(private readonly svc: FixedDepositsService) {}

  @Get()
  @ApiOperation({ summary: 'Search fixed deposits' })
  search(@Query() q: any) {
    return this.svc.search(q);
  }

  @Get(':fdId')
  @ApiOperation({ summary: 'Get FD by ID' })
  findOne(@Param('fdId') fdId: string) {
    return this.svc.findById(fdId);
  }

  @Post()
  @ApiOperation({ summary: 'Place new FD' })
  place(@Body() dto: any, @CurrentUser('userId') userId: string) {
    return this.svc.place(dto, userId);
  }

  @Post(':fdId/liquidate')
  @ApiOperation({ summary: 'Request liquidation' })
  liquidate(@Param('fdId') fdId: string, @Body('reason') reason: string, @CurrentUser('userId') userId: string) {
    return this.svc.earlyLiquidation(fdId, reason, userId);
  }
}