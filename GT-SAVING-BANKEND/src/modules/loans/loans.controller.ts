import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { LoansService } from './loans.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('loans')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('loans')
export class LoansController {
  constructor(private readonly loansService: LoansService) {}

  @Get()
  @ApiOperation({ summary: 'Search loans' })
  search(@Query() query: any) {
    return this.loansService.search(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get loan details' })
  findOne(@Param('id') id: string) {
    return this.loansService.findById(id);
  }

  @Post()
  @ApiOperation({ summary: 'Apply for a loan' })
  create(@Body() dto: any, @CurrentUser('userId') userId: string) {
    return this.loansService.create(dto, userId);
  }
}