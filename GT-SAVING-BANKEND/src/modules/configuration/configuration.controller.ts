import { Controller, Get, Patch, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ConfigurationService } from './configuration.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard.ts';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator.ts';

@ApiTags('configuration')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('configuration')
export class ConfigurationController {
  constructor(private readonly svc: ConfigurationService) {}

  @Get('products')     getProducts()    { return this.svc.getProducts(); }
  @Get('loan-products') getLoanProducts(){ return this.svc.getLoanProducts(); }
  @Get('fees')         getFees()        { return this.svc.getFees(); }
  @Get('approval-matrix') getMatrix()   { return this.svc.getMatrix(); }
  @Get('branches')     getBranches()    { return this.svc.getBranches(); }
  @Get('calendar')     getCalendar()    { return this.svc.getCalendar(); }

  @Patch('products/:code')
  @Roles('super_admin','admin')
  updateProduct(@Param('code') code: string, @Body() dto: any, @CurrentUser() u: any) {
    return this.svc.updateProduct(code, dto, u.userId, u.role);
  }

  @Post('branches')
  @Roles('super_admin','admin')
  createBranch(@Body() dto: any, @CurrentUser('userId') userId: string) {
    return this.svc.createBranch(dto, userId);
  }
}
