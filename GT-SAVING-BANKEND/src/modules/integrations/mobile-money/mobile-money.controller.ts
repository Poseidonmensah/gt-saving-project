import { Controller, Post, Get, Body, Param, Headers, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { MobileMoneyService } from './mobile-money.service';
import { JwtAuthGuard, RolesGuard } from '../../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('mobile-money')
@Controller('integrations/mobile-money')
export class MobileMoneyController {
  constructor(private readonly svc: MobileMoneyService) {}

  @Post('collect')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin','admin','branch_manager','teller')
  initCollection(@Body() dto: any, @CurrentUser('userId') userId: string) {
    return this.svc.initiateCollection(dto, userId);
  }

  @Post('webhook/:provider')
  handleWebhook(
    @Param('provider') provider: string,
    @Body() payload: any,
    @Headers('x-signature') signature: string,
  ) {
    return this.svc.handleCallback(provider, payload, signature || '');
  }

  @Get('status/:internalRef')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  getStatus(@Param('internalRef') ref: string) {
    return this.svc.getStatus(ref);
  }
}
