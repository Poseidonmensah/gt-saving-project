-- ============================================================
-- SEED DATA — Good Time Saving and Loans
-- ============================================================

-- Head Office Branch
INSERT INTO branches (branch_id, branch_code, branch_name, region, address, is_head_office, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'HO001', 'Head Office', 'Greater Accra', 'Accra, Ghana', TRUE, 'active');

-- Super Admin User (password: Admin@GTL2026! — bcrypt hash below)
INSERT INTO users (user_id, username, email, password_hash, full_name, role, branch_id, status, mfa_enabled, must_change_password)
VALUES (
  '00000000-0000-0000-0000-000000000010',
  'superadmin',
  'admin@goodtimeloans.com.gh',
  '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TgxJSA8eQA3KNr1IXdE1FVCFxMGy', -- Admin@GTL2026!
  'System Administrator',
  'super_admin',
  '00000000-0000-0000-0000-000000000001',
  'active',
  TRUE,
  FALSE
);

-- ============================================================
-- CHART OF ACCOUNTS — Ghana Savings & Loans Standard
-- ============================================================

-- ASSETS (1xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_class, account_group, normal_balance, is_control) VALUES
('1000', 'Total Assets', 'asset', 'summary', 'debit', TRUE),
('1100', 'Cash and Cash Equivalents', 'asset', 'current_assets', 'debit', FALSE),
('1101', 'Branch Vault Cash', 'asset', 'current_assets', 'debit', FALSE),
('1102', 'Teller Cash Drawers', 'asset', 'current_assets', 'debit', FALSE),
('1103', 'Cash in Transit', 'asset', 'current_assets', 'debit', FALSE),
('1200', 'Bank and Mobile Money', 'asset', 'current_assets', 'debit', TRUE),
('1201', 'GCB Bank — Operating Account', 'asset', 'current_assets', 'debit', FALSE),
('1202', 'MTN MoMo Collection Account', 'asset', 'current_assets', 'debit', FALSE),
('1203', 'Vodafone Cash Collection Account', 'asset', 'current_assets', 'debit', FALSE),
('1300', 'Loans Receivable', 'asset', 'lending', 'debit', TRUE),
('1301', 'Loans — Current Portion', 'asset', 'lending', 'debit', FALSE),
('1302', 'Loans — Long Term', 'asset', 'lending', 'debit', FALSE),
('1303', 'Non-Performing Loans', 'asset', 'lending', 'debit', FALSE),
('1304', 'Loan Loss Provision', 'asset', 'lending', 'credit', FALSE),
('1400', 'Interest Receivable', 'asset', 'current_assets', 'debit', FALSE),
('1401', 'Accrued Loan Interest Receivable', 'asset', 'current_assets', 'debit', FALSE),
('1402', 'Accrued FD Interest Payable (Asset)', 'asset', 'current_assets', 'debit', FALSE),
('1500', 'Fixed Deposits Placed', 'asset', 'investments', 'debit', FALSE),
('1600', 'Fixed Assets', 'asset', 'non_current', 'debit', FALSE),
('1700', 'Suspense — Assets', 'asset', 'suspense', 'debit', FALSE),
('1701', 'Uncleared Mobile Money', 'asset', 'suspense', 'debit', FALSE),
('1702', 'Uncleared Bank Transfers', 'asset', 'suspense', 'debit', FALSE),
('1703', 'Settlement Suspense', 'asset', 'suspense', 'debit', FALSE),
('1800', 'Prepaid Expenses', 'asset', 'current_assets', 'debit', FALSE),
('1900', 'Other Assets', 'asset', 'other', 'debit', FALSE);

-- LIABILITIES (2xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_class, account_group, normal_balance, is_control) VALUES
('2000', 'Total Liabilities', 'liability', 'summary', 'credit', TRUE),
('2100', 'Customer Savings Deposits', 'liability', 'deposits', 'credit', TRUE),
('2101', 'Savings Accounts — Current Balances', 'liability', 'deposits', 'credit', FALSE),
('2102', 'Salary Savings Accounts', 'liability', 'deposits', 'credit', FALSE),
('2103', 'Current Accounts', 'liability', 'deposits', 'credit', FALSE),
('2200', 'Fixed Deposits', 'liability', 'deposits', 'credit', TRUE),
('2201', 'Fixed Deposits — Principal', 'liability', 'deposits', 'credit', FALSE),
('2202', 'Fixed Deposit Interest Payable', 'liability', 'deposits', 'credit', FALSE),
('2300', 'Loan Collections in Transit', 'liability', 'current_liabilities', 'credit', FALSE),
('2400', 'Mobile Money Payable', 'liability', 'current_liabilities', 'credit', FALSE),
('2401', 'Disbursement Payable — Mobile Money', 'liability', 'current_liabilities', 'credit', FALSE),
('2500', 'Accrued Savings Interest', 'liability', 'accruals', 'credit', FALSE),
('2600', 'Suspense — Liabilities', 'liability', 'suspense', 'credit', FALSE),
('2601', 'Unidentified Credits', 'liability', 'suspense', 'credit', FALSE),
('2700', 'Tax Payable', 'liability', 'current_liabilities', 'credit', FALSE),
('2800', 'Borrowings', 'liability', 'non_current', 'credit', FALSE),
('2900', 'Other Liabilities', 'liability', 'other', 'credit', FALSE);

-- EQUITY (3xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_class, account_group, normal_balance, is_control) VALUES
('3000', 'Total Equity', 'equity', 'summary', 'credit', TRUE),
('3100', 'Share Capital', 'equity', 'paid_in', 'credit', FALSE),
('3200', 'Retained Earnings', 'equity', 'retained', 'credit', FALSE),
('3300', 'Statutory Reserves', 'equity', 'reserves', 'credit', FALSE),
('3900', 'Current Period Profit/Loss', 'equity', 'retained', 'credit', FALSE);

-- INCOME (4xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_class, account_group, normal_balance, is_control) VALUES
('4000', 'Total Income', 'income', 'summary', 'credit', TRUE),
('4100', 'Interest Income — Loans', 'income', 'interest', 'credit', FALSE),
('4101', 'Interest Income — Performing Loans', 'income', 'interest', 'credit', FALSE),
('4102', 'Interest Income — NPL Recovery', 'income', 'interest', 'credit', FALSE),
('4200', 'Fee Income', 'income', 'fees', 'credit', FALSE),
('4201', 'Loan Processing Fees', 'income', 'fees', 'credit', FALSE),
('4202', 'Account Maintenance Fees', 'income', 'fees', 'credit', FALSE),
('4203', 'Withdrawal Fees', 'income', 'fees', 'credit', FALSE),
('4204', 'Transfer Fees', 'income', 'fees', 'credit', FALSE),
('4300', 'Penalty Income', 'income', 'penalties', 'credit', FALSE),
('4301', 'Loan Late Payment Penalties', 'income', 'penalties', 'credit', FALSE),
('4302', 'FD Early Breakage Fees', 'income', 'penalties', 'credit', FALSE),
('4400', 'Fixed Deposit Spread Income', 'income', 'investment', 'credit', FALSE),
('4500', 'Mobile Money Commission', 'income', 'fees', 'credit', FALSE),
('4900', 'Other Income', 'income', 'other', 'credit', FALSE);

-- EXPENSES (5xxx)
INSERT INTO chart_of_accounts (account_code, account_name, account_class, account_group, normal_balance, is_control) VALUES
('5000', 'Total Expenses', 'expense', 'summary', 'debit', TRUE),
('5100', 'Interest Expense — Savings', 'expense', 'interest', 'debit', FALSE),
('5101', 'Interest Expense — Fixed Deposits', 'expense', 'interest', 'debit', FALSE),
('5102', 'Interest Expense — Borrowings', 'expense', 'interest', 'debit', FALSE),
('5200', 'Staff Costs', 'expense', 'operating', 'debit', FALSE),
('5300', 'Loan Loss Provision Expense', 'expense', 'credit_risk', 'debit', FALSE),
('5400', 'Technology and Systems', 'expense', 'operating', 'debit', FALSE),
('5500', 'Mobile Money Charges', 'expense', 'operating', 'debit', FALSE),
('5600', 'Bank Charges', 'expense', 'operating', 'debit', FALSE),
('5700', 'Administrative Expenses', 'expense', 'operating', 'debit', FALSE),
('5900', 'Other Expenses', 'expense', 'other', 'debit', FALSE);

-- ============================================================
-- PRODUCT CONFIGURATIONS
-- ============================================================

-- Savings Products
INSERT INTO product_configs (product_code, product_name, product_type, minimum_balance, minimum_opening,
  interest_rate_pa, interest_method, interest_posting_freq, kyc_tier_required,
  max_daily_withdrawal, max_single_withdrawal, dormancy_days, effective_from, created_by)
VALUES
('SAV001', 'Regular Savings', 'savings', 2000, 5000, 0.07, 'daily_balance', 'monthly', 'tier_1',
  500000, 200000, 180, '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('SAV002', 'Premium Savings', 'savings', 100000, 100000, 0.10, 'daily_balance', 'monthly', 'tier_2',
  2000000, 1000000, 365, '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('SAV003', 'Salary Savings', 'savings', 0, 0, 0.08, 'daily_balance', 'monthly', 'tier_1',
  1000000, 500000, 365, '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('FD001', 'Fixed Deposit — 90 Days', 'fixed_deposit', 100000, 100000, 0.14, 'daily_balance', 'quarterly', 'tier_1',
  NULL, NULL, 90, '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('FD002', 'Fixed Deposit — 180 Days', 'fixed_deposit', 100000, 100000, 0.16, 'daily_balance', 'quarterly', 'tier_1',
  NULL, NULL, 180, '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('FD003', 'Fixed Deposit — 365 Days', 'fixed_deposit', 100000, 100000, 0.19, 'daily_balance', 'annually', 'tier_1',
  NULL, NULL, 365, '2026-01-01', '00000000-0000-0000-0000-000000000010');

-- Fixed deposit min/max tenor
UPDATE product_configs SET min_tenor_days=90, max_tenor_days=90 WHERE product_code='FD001';
UPDATE product_configs SET min_tenor_days=180, max_tenor_days=180 WHERE product_code='FD002';
UPDATE product_configs SET min_tenor_days=365, max_tenor_days=365 WHERE product_code='FD003';
UPDATE product_configs SET early_breakage_penalty_rate=0.02 WHERE product_code LIKE 'FD%';

-- Loan Products
INSERT INTO loan_products (product_code, product_name, min_amount, max_amount, min_tenor_months, max_tenor_months,
  interest_rate_pa, interest_method, repayment_freq, grace_period_days, penalty_rate_pd,
  processing_fee_rate, requires_collateral, requires_guarantor, kyc_tier_required, created_by)
VALUES
('LN001', 'Personal Loan', 50000, 5000000, 3, 24, 0.30, 'reducing_balance', 'monthly', 0, 0.001, 0.02, FALSE, TRUE, 'tier_1', '00000000-0000-0000-0000-000000000010'),
('LN002', 'Business Loan', 500000, 50000000, 6, 36, 0.28, 'reducing_balance', 'monthly', 30, 0.001, 0.02, TRUE, FALSE, 'tier_2', '00000000-0000-0000-0000-000000000010'),
('LN003', 'Salary Advance', 10000, 1000000, 1, 12, 0.25, 'flat', 'monthly', 0, 0.002, 0.01, FALSE, FALSE, 'tier_1', '00000000-0000-0000-0000-000000000010'),
('LN004', 'Micro Loan', 10000, 500000, 1, 12, 0.35, 'flat', 'weekly', 0, 0.002, 0.03, FALSE, FALSE, 'tier_1', '00000000-0000-0000-0000-000000000010');

-- ============================================================
-- FEE CONFIGURATIONS
-- ============================================================
INSERT INTO fee_configs (product_code, fee_code, fee_name, fee_type, flat_amount, percentage_rate, gl_account_code, effective_from, created_by)
VALUES
('SAV001', 'MAINT_FEE', 'Monthly Maintenance Fee', 'flat', 200, NULL, '4202', '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('SAV002', 'MAINT_FEE', 'Monthly Maintenance Fee', 'flat', 0, NULL, '4202', '2026-01-01', '00000000-0000-0000-0000-000000000010'),
('SAV001', 'WITHDRAW_FEE', 'Withdrawal Fee (OTC)', 'flat', 100, NULL, '4203', '2026-01-01', '00000000-0000-0000-0000-000000000010');

-- ============================================================
-- APPROVAL MATRIX
-- ============================================================
INSERT INTO approval_matrix (workflow_type, min_amount, max_amount, required_role_1, required_role_2, sla_hours, created_by)
VALUES
-- Cash Withdrawal approvals
('withdrawal', 0, 499999, NULL, NULL, 0, '00000000-0000-0000-0000-000000000010'),              -- Teller self-approved
('withdrawal', 500000, 4999999, 'branch_manager', NULL, 4, '00000000-0000-0000-0000-000000000010'),
('withdrawal', 5000000, NULL, 'branch_manager', 'admin', 8, '00000000-0000-0000-0000-000000000010'),
-- Loan disbursement
('loan_disbursement', 0, 4999999, 'loan_officer', 'branch_manager', 24, '00000000-0000-0000-0000-000000000010'),
('loan_disbursement', 5000000, 49999999, 'branch_manager', 'admin', 48, '00000000-0000-0000-0000-000000000010'),
('loan_disbursement', 50000000, NULL, 'admin', 'super_admin', 72, '00000000-0000-0000-0000-000000000010'),
-- Account opening
('account_open', 0, NULL, NULL, NULL, 2, '00000000-0000-0000-0000-000000000010'),
-- FD early breakage
('fd_break', 0, NULL, 'branch_manager', NULL, 4, '00000000-0000-0000-0000-000000000010'),
-- Loan restructure
('loan_restructure', 0, NULL, 'branch_manager', 'admin', 48, '00000000-0000-0000-0000-000000000010'),
-- Account freeze
('account_freeze', 0, NULL, 'compliance_officer', NULL, 1, '00000000-0000-0000-0000-000000000010');

-- ============================================================
-- BUSINESS CALENDAR — 2026 Ghana Public Holidays
-- ============================================================
INSERT INTO business_calendar (calendar_date, is_working_day, holiday_name)
VALUES
('2026-01-01', FALSE, 'New Year''s Day'),
('2026-03-06', FALSE, 'Independence Day'),
('2026-04-03', FALSE, 'Good Friday'),
('2026-04-06', FALSE, 'Easter Monday'),
('2026-05-01', FALSE, 'Workers'' Day'),
('2026-05-25', FALSE, 'Africa Day'),
('2026-07-01', FALSE, 'Republic Day'),
('2026-09-21', FALSE, 'Founder''s Day'),
('2026-12-25', FALSE, 'Christmas Day'),
('2026-12-26', FALSE, 'Boxing Day');

-- Weekend rules applied by application logic (Sat/Sun non-working)

-- ============================================================
-- INITIAL GL BALANCES (zeroed — day 1)
-- ============================================================
-- Populated by end-of-day batch process

-- ============================================================
-- SUSPENSE GL ACCOUNTS (internal virtual accounts)
-- ============================================================
INSERT INTO accounts (account_id, account_number, product_code, account_type, branch_id, currency, status, created_by)
VALUES
('00000000-0000-0000-0000-000000001001', '0000000001', 'INTERNAL', 'suspense', '00000000-0000-0000-0000-000000000001', 'GHS', 'active', '00000000-0000-0000-0000-000000000010'),
('00000000-0000-0000-0000-000000001002', '0000000002', 'INTERNAL', 'suspense', '00000000-0000-0000-0000-000000000001', 'GHS', 'active', '00000000-0000-0000-0000-000000000010');
