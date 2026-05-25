// ============================================================
// REPORTS MODULE
// src/modules/reports/reports.service.ts
// ============================================================
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { v4 as uuid } from 'uuid';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { FinancialMath } from '../../common/utils/financial.util';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private dataSource: DataSource,
    private audit: AuditService,
  ) {}

  // ─── TRIAL BALANCE ───────────────────────────────────────
  async trialBalance(params: ReportParams) {
    const { fromDate, toDate, branchId } = params;
    const rows = await this.dataSource.query(
      `SELECT coa.account_code, coa.account_name, coa.account_class,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) as total_debits,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) as total_credits
       FROM chart_of_accounts coa
       LEFT JOIN ledger_entries le ON le.account_code = coa.account_code
       LEFT JOIN journal_entries j ON j.journal_id = le.journal_id
         AND j.posting_date BETWEEN $1 AND $2
         ${branchId ? `AND le.branch_id = '${branchId}'` : ''}
       WHERE coa.is_active = true
       GROUP BY coa.account_code, coa.account_name, coa.account_class
       ORDER BY coa.account_code`,
      [fromDate, toDate]
    );
    const totalDebits = rows.reduce((s: bigint, r: any) => s + BigInt(r.total_debits), 0n);
    const totalCredits = rows.reduce((s: bigint, r: any) => s + BigInt(r.total_credits), 0n);
    return { rows, totalDebits: totalDebits.toString(), totalCredits: totalCredits.toString(), balanced: totalDebits === totalCredits };
  }

  // ─── PROFIT & LOSS ───────────────────────────────────────
  async profitAndLoss(params: ReportParams) {
    const { fromDate, toDate } = params;
    const rows = await this.dataSource.query(
      `SELECT coa.account_code, coa.account_name, coa.account_class, coa.account_group,
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'credit'), 0) -
        COALESCE(SUM(le.amount) FILTER (WHERE le.entry_type = 'debit'), 0) as net_balance
       FROM chart_of_accounts coa
       LEFT JOIN ledger_entries le ON le.account_code = coa.account_code
       LEFT JOIN journal_entries j ON j.journal_id = le.journal_id
         AND j.posting_date BETWEEN $1 AND $2
       WHERE coa.account_class IN ('income', 'expense')
       GROUP BY coa.account_code, coa.account_name, coa.account_class, coa.account_group
       ORDER BY coa.account_class, coa.account_code`,
      [fromDate, toDate]
    );
    const totalIncome = rows.filter((r: any) => r.account_class === 'income').reduce((s: bigint, r: any) => s + BigInt(r.net_balance), 0n);
    const totalExpense = rows.filter((r: any) => r.account_class === 'expense').reduce((s: bigint, r: any) => s + BigInt(r.net_balance), 0n);
    const netProfit = totalIncome - totalExpense;
    return { rows, totalIncome: totalIncome.toString(), totalExpense: totalExpense.toString(), netProfit: netProfit.toString() };
  }

  // ─── LOAN PORTFOLIO ──────────────────────────────────────
  async loanPortfolio(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        l.loan_number, c.full_name, c.customer_number, l.product_code, l.status,
        l.principal_amount, l.outstanding_principal, l.accrued_interest,
        l.accrued_penalty, l.days_in_arrears, l.risk_grade,
        l.disbursement_date, l.maturity_date
       FROM loans l
       JOIN customers c ON c.customer_id = l.customer_id
       WHERE l.status NOT IN ('draft','rejected')
         ${params.branchId ? `AND l.branch_id = '${params.branchId}'` : ''}
       ORDER BY l.status, l.days_in_arrears DESC`
    );
  }

  // ─── ARREARS AGING ───────────────────────────────────────
  async arrearsAging(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        l.loan_number, c.full_name, c.phone_number, l.outstanding_principal,
        l.accrued_penalty, l.days_in_arrears,
        CASE
          WHEN l.days_in_arrears BETWEEN 1 AND 30 THEN '1-30 days'
          WHEN l.days_in_arrears BETWEEN 31 AND 60 THEN '31-60 days'
          WHEN l.days_in_arrears BETWEEN 61 AND 90 THEN '61-90 days'
          ELSE '90+ days'
        END as aging_bucket
       FROM loans l
       JOIN customers c ON c.customer_id = l.customer_id
       WHERE l.status IN ('in_arrears','default')
         ${params.branchId ? `AND l.branch_id = '${params.branchId}'` : ''}
       ORDER BY l.days_in_arrears DESC`
    );
  }

  // ─── DISBURSEMENT REPORT ─────────────────────────────────
  async disbursementReport(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        l.loan_number, c.full_name, c.customer_number, l.product_code,
        l.disbursed_amount, l.interest_rate_pa, l.tenor_months,
        l.disbursement_date, l.maturity_date, l.status,
        u.full_name as loan_officer
       FROM loans l
       JOIN customers c ON c.customer_id = l.customer_id
       LEFT JOIN users u ON u.user_id = l.loan_officer_id
       WHERE l.disbursement_date BETWEEN $1 AND $2
         ${params.branchId ? `AND l.branch_id = '${params.branchId}'` : ''}
       ORDER BY l.disbursement_date DESC`,
      [params.fromDate, params.toDate]
    );
  }

  // ─── TELLER COLLECTIONS ──────────────────────────────────
  async tellerCollections(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        u.full_name as teller_name, u.username,
        COUNT(t.*) as transaction_count,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'deposit') as total_deposits,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'withdrawal') as total_withdrawals,
        SUM(t.fees) as total_fees_collected,
        d.opening_balance, d.closing_balance,
        d.closing_balance - d.opening_balance as net_movement
       FROM teller_drawers d
       JOIN users u ON u.user_id = d.teller_user_id
       LEFT JOIN transactions t ON t.drawer_id = d.drawer_id AND t.status = 'posted'
       WHERE d.business_date BETWEEN $1 AND $2
         ${params.branchId ? `AND d.branch_id = '${params.branchId}'` : ''}
       GROUP BY u.full_name, u.username, d.opening_balance, d.closing_balance, d.drawer_id
       ORDER BY d.business_date, u.full_name`,
      [params.fromDate, params.toDate]
    );
  }

  // ─── CASH POSITION REPORT ────────────────────────────────
  async cashPosition(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        b.branch_name, b.branch_code,
        SUM(d.opening_balance) as opening_cash,
        SUM(d.closing_balance) as closing_cash,
        SUM(d.closing_balance) - SUM(d.opening_balance) as net_change
       FROM teller_drawers d
       JOIN branches b ON b.branch_id = d.branch_id
       WHERE d.business_date = $1
       GROUP BY b.branch_name, b.branch_code
       ORDER BY b.branch_code`,
      [params.fromDate]
    );
  }

  // ─── DEPOSIT GROWTH ──────────────────────────────────────
  async depositGrowth(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        DATE_TRUNC('month', t.business_date) as month,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'deposit') as total_deposits,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'withdrawal') as total_withdrawals,
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'deposit') -
        SUM(t.amount) FILTER (WHERE t.transaction_type = 'withdrawal') as net_growth
       FROM transactions t
       WHERE t.business_date BETWEEN $1 AND $2 AND t.status = 'posted'
       GROUP BY DATE_TRUNC('month', t.business_date)
       ORDER BY month`,
      [params.fromDate, params.toDate]
    );
  }

  // ─── KYC STATUS REPORT ───────────────────────────────────
  async kycStatus(params: ReportParams) {
    return this.dataSource.query(
      `SELECT
        kyc_status, kyc_tier, COUNT(*) as count,
        COUNT(*) FILTER (WHERE pep_flag = true) as pep_count,
        COUNT(*) FILTER (WHERE sanctions_flag = true) as sanctions_count
       FROM customers
       WHERE created_at BETWEEN $1 AND $2
         ${params.branchId ? `AND branch_id = '${params.branchId}'` : ''}
       GROUP BY kyc_status, kyc_tier
       ORDER BY kyc_status, kyc_tier`,
      [params.fromDate, params.toDate]
    );
  }

  // ─── HIGH VALUE TRANSACTIONS ─────────────────────────────
  async highValueTransactions(params: ReportParams) {
    const threshold = 500000000n; // GHS 5,000,000
    return this.dataSource.query(
      `SELECT t.*, c.full_name as customer_name, c.customer_number,
        a.account_number, u.username as teller
       FROM transactions t
       LEFT JOIN accounts a ON a.account_id = COALESCE(t.source_account_id, t.dest_account_id)
       LEFT JOIN customers c ON c.customer_id = a.customer_id
       LEFT JOIN users u ON u.user_id = t.initiated_by
       WHERE t.amount >= $1 AND t.business_date BETWEEN $2 AND $3 AND t.status = 'posted'
       ORDER BY t.amount DESC`,
      [threshold.toString(), params.fromDate, params.toDate]
    );
  }

  // ─── EXPORT FUNCTIONS ────────────────────────────────────

  async exportToPDF(title: string, headers: string[], rows: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];

      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(16).font('Helvetica-Bold').text('Good Time Saving & Loans', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text(title, { align: 'center' });
      doc.fontSize(9).text(`Generated: ${new Date().toLocaleString('en-GH')}`, { align: 'center' });
      doc.moveDown();

      // Table header
      const colWidth = (doc.page.width - 100) / headers.length;
      let x = 50;
      doc.font('Helvetica-Bold').fontSize(8);
      headers.forEach(h => {
        doc.text(h, x, doc.y, { width: colWidth, continued: false });
        x += colWidth;
      });
      doc.moveDown(0.5);
      doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y).stroke();
      doc.moveDown(0.5);

      // Table rows
      doc.font('Helvetica').fontSize(7);
      rows.slice(0, 500).forEach(row => {
        x = 50;
        const vals = Object.values(row);
        vals.forEach((val: any, i) => {
          doc.text(String(val ?? ''), x, doc.y, { width: colWidth, continued: i < vals.length - 1 });
          if (i < vals.length - 1) x += colWidth;
        });
        if (doc.y > doc.page.height - 100) doc.addPage();
      });

      doc.end();
    });
  }

  async exportToExcel(title: string, headers: string[], rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Good Time S&L System';
    const sheet = workbook.addWorksheet(title.substring(0, 31));

    // Title row
    sheet.mergeCells(1, 1, 1, headers.length);
    sheet.getCell('A1').value = 'Good Time Saving & Loans Management System';
    sheet.getCell('A1').font = { bold: true, size: 14 };
    sheet.getCell('A1').alignment = { horizontal: 'center' };

    sheet.mergeCells(2, 1, 2, headers.length);
    sheet.getCell('A2').value = title;
    sheet.getCell('A2').font = { bold: true, size: 12 };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    sheet.mergeCells(3, 1, 3, headers.length);
    sheet.getCell('A3').value = `Generated: ${new Date().toLocaleString('en-GH')}`;
    sheet.getCell('A3').alignment = { horizontal: 'center' };

    // Header row
    const headerRow = sheet.addRow(headers);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F497D' } };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Data rows
    rows.forEach(row => {
      const vals = Object.values(row).map(v =>
        typeof v === 'bigint' ? Number(v) / 100 : v
      );
      sheet.addRow(vals);
    });

    // Auto-fit columns
    sheet.columns.forEach(col => { col.width = 18; });

    // Borders
    sheet.eachRow({ includeEmpty: false }, row => {
      row.eachCell({ includeEmpty: true }, cell => {
        cell.border = {
          top: { style: 'thin' }, left: { style: 'thin' },
          bottom: { style: 'thin' }, right: { style: 'thin' },
        };
      });
    });

    return workbook.xlsx.writeBuffer() as Promise<Buffer>;
  }

  async exportToCSV(headers: string[], rows: any[]): Promise<string> {
    const data = rows.map(row =>
      Object.values(row).map(v => typeof v === 'bigint' ? Number(v) / 100 : v)
    );
    return stringify([headers, ...data]);
  }

  async generateReport(reportType: string, params: ReportParams, format: 'pdf' | 'excel' | 'csv', requestedBy: string) {
    this.logger.log(`Generating ${reportType} report in ${format}...`);

    let data: any[];
    let title: string;
    let headers: string[];

    switch (reportType) {
      case 'trial_balance':
        const tb = await this.trialBalance(params);
        data = tb.rows;
        title = 'Trial Balance';
        headers = ['Account Code', 'Account Name', 'Class', 'Total Debits (GHS)', 'Total Credits (GHS)'];
        break;
      case 'loan_portfolio':
        data = await this.loanPortfolio(params);
        title = 'Loan Portfolio Report';
        headers = ['Loan No.', 'Customer', 'CIF', 'Product', 'Status', 'Principal', 'Outstanding', 'Accrued Interest', 'Penalty', 'Days Arrears', 'Grade', 'Disbursed', 'Maturity'];
        break;
      case 'arrears_aging':
        data = await this.arrearsAging(params);
        title = 'Loan Arrears Aging Report';
        headers = ['Loan No.', 'Customer', 'Phone', 'Outstanding', 'Penalty', 'Days Overdue', 'Bucket'];
        break;
      case 'disbursement':
        data = await this.disbursementReport(params);
        title = 'Loan Disbursement Report';
        headers = ['Loan No.', 'Customer', 'CIF', 'Product', 'Amount (GHS)', 'Rate', 'Tenor', 'Disbursed', 'Maturity', 'Status', 'Officer'];
        break;
      case 'teller_collections':
        data = await this.tellerCollections(params);
        title = 'Teller Collections Report';
        headers = ['Teller', 'Username', 'Transactions', 'Deposits', 'Withdrawals', 'Fees', 'Opening Cash', 'Closing Cash', 'Net Movement'];
        break;
      case 'cash_position':
        data = await this.cashPosition(params);
        title = 'Branch Cash Position';
        headers = ['Branch', 'Code', 'Opening Cash', 'Closing Cash', 'Net Change'];
        break;
      case 'high_value_transactions':
        data = await this.highValueTransactions(params);
        title = 'High Value Transactions Report';
        headers = ['Ref', 'Type', 'Channel', 'Account', 'Customer', 'Amount (GHS)', 'Date', 'Teller', 'Status'];
        break;
      case 'kyc_status':
        data = await this.kycStatus(params);
        title = 'KYC Status Summary';
        headers = ['KYC Status', 'Tier', 'Count', 'PEP Flagged', 'Sanctions Flagged'];
        break;
      default:
        throw new NotFoundException(`Report type '${reportType}' not found`);
    }

    await this.audit.log({
      actorUserId: requestedBy,
      actorRole: 'admin',
      actionType: 'REPORT_GENERATED',
      entityType: 'report',
      entityId: reportType,
      afterValue: { reportType, format, params },
    });

    if (format === 'pdf') return { buffer: await this.exportToPDF(title, headers, data), mimeType: 'application/pdf', filename: `${reportType}_${Date.now()}.pdf` };
    if (format === 'excel') return { buffer: await this.exportToExcel(title, headers, data), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `${reportType}_${Date.now()}.xlsx` };
    return { buffer: Buffer.from(await this.exportToCSV(headers, data)), mimeType: 'text/csv', filename: `${reportType}_${Date.now()}.csv` };
  }

  async getDashboardSummary(branchId?: string) {
    const branchFilter = branchId ? `AND branch_id = '${branchId}'` : '';
    const today = new Date().toISOString().split('T')[0];
    const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];

    const [deposits] = await this.dataSource.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM transactions WHERE transaction_type = 'deposit'
         AND status = 'posted' AND business_date = $1 ${branchFilter}`, [today]
    );
    const [withdrawals] = await this.dataSource.query(
      `SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total
       FROM transactions WHERE transaction_type = 'withdrawal'
         AND status = 'posted' AND business_date = $1 ${branchFilter}`, [today]
    );
    const [loans] = await this.dataSource.query(
      `SELECT COUNT(*) FILTER (WHERE status = 'active') as active_loans,
              COUNT(*) FILTER (WHERE status = 'in_arrears') as arrears_loans,
              COALESCE(SUM(outstanding_principal), 0) as total_outstanding
       FROM loans WHERE 1=1 ${branchFilter}`
    );
    const [customers] = await this.dataSource.query(
      `SELECT COUNT(*) as total_customers,
              COUNT(*) FILTER (WHERE created_at >= $1) as new_this_month
       FROM customers WHERE 1=1 ${branchFilter}`, [monthStart]
    );
    const [pendingWorkflows] = await this.dataSource.query(
      `SELECT COUNT(*) as pending FROM workflow_requests WHERE status = 'pending'`
    );

    return {
      today: {
        deposits: { count: deposits.count, total: deposits.total },
        withdrawals: { count: withdrawals.count, total: withdrawals.total },
      },
      loans: {
        active: loans.active_loans,
        inArrears: loans.arrears_loans,
        totalOutstanding: loans.total_outstanding,
      },
      customers: {
        total: customers.total_customers,
        newThisMonth: customers.new_this_month,
      },
      pendingApprovals: pendingWorkflows.pending,
      generatedAt: new Date(),
    };
  }
}

interface ReportParams {
  fromDate: string;
  toDate: string;
  branchId?: string;
  productCode?: string;
  userId?: string;
}

// ============================================================
// REPORTS CONTROLLER
// ============================================================
import { Controller, Get, Post, Query, Param, Res, UseGuards, Body } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard, RolesGuard } from '../../common/guards/jwt-auth.guard';
import { Roles, CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('reports')
export class ReportsController {
  constructor(private reportsService: ReportsService) {}

  @Get('dashboard')
  getDashboard(@Query('branchId') branchId?: string) {
    return this.reportsService.getDashboardSummary(branchId);
  }

  @Get('generate/:type')
  @Roles('admin','super_admin','branch_manager','accountant','auditor','compliance_officer')
  async generate(
    @Param('type') type: string,
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('branchId') branchId: string,
    @Query('format') format: 'pdf' | 'excel' | 'csv' = 'excel',
    @CurrentUser('userId') userId: string,
    @Res() res: Response,
  ) {
    const result = await this.reportsService.generateReport(
      type, { fromDate, toDate, branchId }, format, userId
    );
    res.setHeader('Content-Type', result.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
    res.send(result.buffer);
  }

  @Get('trial-balance')
  @Roles('admin','super_admin','accountant','auditor')
  trialBalance(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.trialBalance({ fromDate, toDate, branchId });
  }

  @Get('loan-portfolio')
  @Roles('admin','super_admin','branch_manager','credit_analyst','auditor')
  loanPortfolio(@Query('branchId') branchId?: string) {
    return this.reportsService.loanPortfolio({ fromDate: '', toDate: '', branchId });
  }

  @Get('arrears-aging')
  @Roles('admin','super_admin','branch_manager','credit_analyst','compliance_officer')
  arrearsAging(@Query('branchId') branchId?: string) {
    return this.reportsService.arrearsAging({ fromDate: '', toDate: '', branchId });
  }

  @Get('disbursements')
  @Roles('admin','super_admin','branch_manager','loan_officer')
  disbursements(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.disbursementReport({ fromDate, toDate, branchId });
  }

  @Get('teller-collections')
  @Roles('admin','super_admin','branch_manager','accountant')
  tellerCollections(
    @Query('fromDate') fromDate: string,
    @Query('toDate') toDate: string,
    @Query('branchId') branchId?: string,
  ) {
    return this.reportsService.tellerCollections({ fromDate, toDate, branchId });
  }
}
