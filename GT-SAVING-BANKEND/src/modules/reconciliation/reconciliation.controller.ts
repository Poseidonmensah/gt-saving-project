import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ReconciliationService } from './reconciliation.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reconciliation')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reconciliation')
export class ReconciliationController {
  constructor(private readonly svc: ReconciliationService) {}

  @Get()
  @Roles('super_admin','admin','accountant','auditor')
  getSessions(@Query() query: any) { return this.svc.getSessions(query); }

  @Post('session')
  @Roles('super_admin','admin','accountant')
  startSession(@Body() body: { type: string; branchId: string }, @CurrentUser('userId') userId: string) {
    return this.svc.startSession(body.type, body.branchId, userId);
  }

  @Post(':sessionId/cash')
  @Roles('super_admin','admin','accountant')
  reconcileCash(@Param('sessionId') id: string, @Body('physicalCount') pc: string, @CurrentUser('userId') userId: string) {
    return this.svc.reconcileCash(id, BigInt(pc), userId);
  }

  @Post(':sessionId/gl')
  @Roles('super_admin','admin','accountant')
  reconcileGL(@Param('sessionId') id: string) { return this.svc.reconcileGL(id); }

  @Get(':sessionId/exceptions')
  @Roles('super_admin','admin','accountant','auditor')
  getExceptions(@Param('sessionId') id: string) { return this.svc.getExceptions(id); }

  @Post('exceptions/:exceptionId/resolve')
  @Roles('super_admin','admin','accountant')
  resolve(@Param('exceptionId') id: string, @Body('notes') notes: string, @CurrentUser('userId') userId: string) {
    return this.svc.resolveException(id, notes, userId);
  }
}
