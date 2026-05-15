import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('notifications')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly svc: NotificationsService) {}

  @Get('customer/:customerId')
  @Roles('super_admin','admin','branch_manager','customer_care','customer')
  getForCustomer(
    @Param('customerId') customerId: string,
    @Query('page') page = 1, @Query('limit') limit = 20,
  ) {
    return this.svc.getForCustomer(customerId, +page, +limit);
  }
}
