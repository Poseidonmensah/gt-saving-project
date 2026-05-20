import { Controller, Get, Post, Body, Param, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { AccountsService } from './accounts.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('accounts')
@Controller('accounts')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('JWT')
export class AccountsController {
  constructor(private readonly accountsService: AccountsService) {}

  @Get(':accountId/balance')
  @ApiOperation({ summary: 'Get account balance' })
  getBalance(@Param('accountId') accountId: string) {
    return this.accountsService.getBalance(accountId);
  }

  @Get(':accountId/statement')
  @ApiOperation({ summary: 'Get account statement' })
  getStatement(
    @Param('accountId') accountId: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('page') page: number = 1,
    @Query('limit') limit: number = 50,
  ) {
    return this.accountsService.getStatement(
      accountId, 
      new Date(fromDate), 
      new Date(toDate), 
      page, 
      limit
    );
  }

  @Post(':accountId/activate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a pending account' })
  activate(
    @Param('accountId') accountId: string, 
    @CurrentUser('userId') userId: string
  ) {
    return this.accountsService.activate(accountId, userId);
  }
}