import { Controller, Get, Post, Param, Body, Query, UseGuards, Req } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { WorkflowService } from './workflow.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { CurrentUser, Roles } from '../../common/decorators';

@ApiTags('workflow')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly svc: WorkflowService) {}

  @Get()
  getAll(@Query() query: any, @CurrentUser() user: any) {
    return this.svc.getAll(query);
  }

  @Get('pending')
  getPending(@CurrentUser() user: any) {
    return this.svc.getPending(user.role);
  }

  @Get(':requestId')
  getById(@Param('requestId') requestId: string) {
    return this.svc.getById(requestId);
  }

  @Post(':requestId/approve')
  approve(
    @Param('requestId') requestId: string,
    @Body('notes') notes: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.svc.processAction(requestId, user.userId, user.role, 'approve', notes, req.ip);
  }

  @Post(':requestId/reject')
  reject(
    @Param('requestId') requestId: string,
    @Body('notes') notes: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.svc.processAction(requestId, user.userId, user.role, 'reject', notes, req.ip);
  }

  @Post(':requestId/escalate')
  escalate(
    @Param('requestId') requestId: string,
    @Body('notes') notes: string,
    @CurrentUser() user: any,
    @Req() req: any,
  ) {
    return this.svc.processAction(requestId, user.userId, user.role, 'escalate', notes, req.ip);
  }
}
