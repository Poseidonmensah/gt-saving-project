import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import PDFDocument from 'pdfkit';
import ExcelJS from 'exceljs';
import { stringify } from 'csv-stringify/sync';
import { AuditService } from '../audit/audit.service';

export interface ReportParams {
  fromDate: string;
  toDate: string;
  branchId?: string;
  productCode?: string;
  userId?: string;
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private dataSource: DataSource,
    private audit: AuditService,
  ) {}

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

  async loanPortfolio(params: ReportParams) {
    return this.dataSource.query(
      `SELECT l.loan_number, c.full_name, l.status, l.outstanding_principal FROM loans l JOIN customers c ON c.customer_id = l.customer_id`
    );
  }

  async arrearsAging(params: ReportParams) {
    return this.dataSource.query(`SELECT l.loan_number, l.days_in_arrears FROM loans l WHERE l.status = 'in_arrears'`);
  }

  async disbursementReport(params: ReportParams) {
    return this.dataSource.query(`SELECT * FROM loans WHERE disbursement_date BETWEEN $1 AND $2`, [params.fromDate, params.toDate]);
  }

  async tellerCollections(params: ReportParams) {
    return this.dataSource.query(`SELECT * FROM teller_drawers WHERE business_date BETWEEN $1 AND $2`, [params.fromDate, params.toDate]);
  }

  async cashPosition(params: ReportParams) {
    return this.dataSource.query(`SELECT * FROM branches`);
  }

  async highValueTransactions(params: ReportParams) {
    return this.dataSource.query(`SELECT * FROM transactions WHERE amount > 5000000`);
  }

  async kycStatus(params: ReportParams) {
    return this.dataSource.query(`SELECT kyc_status, COUNT(*) FROM customers GROUP BY kyc_status`);
  }

  async exportToPDF(title: string, headers: string[], rows: any[]): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50, size: 'A4', layout: 'landscape' });
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.text(title);
      doc.end();
    });
  }

  async exportToExcel(title: string, headers: string[], rows: any[]): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet(title.substring(0, 31));
    sheet.addRow(headers);
    rows.forEach(row => sheet.addRow(Object.values(row)));
    // FIX FOR ERROR TS2352:
    return workbook.xlsx.writeBuffer() as any as Promise<Buffer>;
  }

  async exportToCSV(headers: string[], rows: any[]): Promise<string> {
    const data = rows.map(row => Object.values(row));
    return stringify([headers, ...data]);
  }

  async generateReport(reportType: string, params: ReportParams, format: 'pdf' | 'excel' | 'csv', requestedBy: string) {
    let data: any[] = [];
    let title = 'Report';
    let headers: string[] = [];

    if (reportType === 'trial_balance') {
      const tb = await this.trialBalance(params);
      data = tb.rows;
      headers = ['Code', 'Name', 'Class', 'Debits', 'Credits'];
    }

    if (format === 'pdf') return { buffer: await this.exportToPDF(title, headers, data), mimeType: 'application/pdf', filename: `rep.pdf` };
    if (format === 'excel') return { buffer: await this.exportToExcel(title, headers, data), mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename: `rep.xlsx` };
    return { buffer: Buffer.from(await this.exportToCSV(headers, data)), mimeType: 'text/csv', filename: `rep.csv` };
  }

  async getDashboardSummary(branchId?: string) {
    return { generatedAt: new Date(), summary: "Dashboard data" };
  }
}