import { Controller, Get, Query, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { LedgerService } from './ledger.service';
import { JwtAuthGuard, RolesGuard } from '../../common/guards';
import { Roles } from '../../common/decorators';

@ApiTags('ledger')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('ledger')
export class LedgerController {
  constructor(private readonly ledgerService: LedgerService) {}

  @Get('trial-balance')
  @Roles('super_admin', 'admin', 'accountant', 'auditor', 'branch_manager')
  getTrialBalance(
    @Query('date') date: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.ledgerService.getTrialBalance(new Date(date || new Date().toISOString().split('T')[0]), branchId);
  }

  @Get('account/:accountCode')
  @Roles('super_admin', 'admin', 'accountant', 'auditor')
  getAccountLedger(
    @Param('accountCode') accountCode: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
  ) {
    return this.ledgerService.getAccountLedger(accountCode, new Date(fromDate), new Date(toDate));
  }

  @Get('journals/:journalId')
  @Roles('super_admin', 'admin', 'accountant', 'auditor')
  getJournal(@Param('journalId') journalId: string) {
    return this.ledgerService.getJournal(journalId);
  }

  @Get('chart-of-accounts')
  @Roles('super_admin', 'admin', 'accountant', 'auditor', 'branch_manager')
  getChartOfAccounts() {
    return this.ledgerService['journalRepo'].manager.query(
      `SELECT * FROM chart_of_accounts WHERE is_active = true ORDER BY account_code`
    );
  }

  @Get('gl-balances')
  @Roles('super_admin', 'admin', 'accountant', 'auditor')
  getGLBalances(
    @Query('periodDate') periodDate: string,
    @Query('branchId') branchId?: string,
  ) {
    const where = branchId ? `AND branch_id = '${branchId}'` : '';
    return this.ledgerService['journalRepo'].manager.query(
      `SELECT b.*, coa.account_name, coa.account_class
       FROM gl_account_balances b
       JOIN chart_of_accounts coa ON coa.account_code = b.account_code
       WHERE b.period_date = $1 ${where}
       ORDER BY b.account_code`,
      [periodDate]
    );
  }
}
