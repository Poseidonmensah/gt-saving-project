-- ============================================================
-- GOOD TIME SAVING AND LOANS MANAGEMENT SYSTEM
-- Database Schema v1.0 — PostgreSQL 15+
-- All monetary values stored as BIGINT (pesewas, ×100 of GHS)
-- ============================================================

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- ENUMERATIONS
-- ============================================================
CREATE TYPE user_status AS ENUM ('active','inactive','locked','suspended');
CREATE TYPE user_role AS ENUM ('super_admin','admin','branch_manager','teller','loan_officer','credit_analyst','accountant','auditor','compliance_officer','customer_care','customer');
CREATE TYPE kyc_tier AS ENUM ('tier_1','tier_2','tier_3');
CREATE TYPE kyc_status AS ENUM ('pending','in_review','approved','rejected','expired');
CREATE TYPE risk_rating AS ENUM ('low','medium','high','pep','sanctioned');
CREATE TYPE customer_status AS ENUM ('prospect','active','dormant','restricted','frozen','closed');
CREATE TYPE account_type AS ENUM ('savings','current','salary','fixed_deposit','loan','suspense','gl_control');
CREATE TYPE account_status AS ENUM ('pending','active','dormant','restricted','frozen','closed');
CREATE TYPE transaction_type AS ENUM ('deposit','withdrawal','transfer','loan_disbursement','loan_repayment','fd_placement','fd_liquidation','interest_credit','fee_debit','penalty_debit','reversal','adjustment','mobile_money_in','mobile_money_out','bank_transfer_in','bank_transfer_out');
CREATE TYPE transaction_channel AS ENUM ('teller','mobile_money','bank_transfer','internal','self_service','agency','batch');
CREATE TYPE transaction_status AS ENUM ('pending','processing','posted','reversed','failed','cancelled','held');
CREATE TYPE loan_status AS ENUM ('draft','submitted','under_review','approved','rejected','disbursed','active','restructured','in_arrears','default','written_off','closed');
CREATE TYPE repayment_status AS ENUM ('scheduled','paid','partial','overdue','waived');
CREATE TYPE fd_status AS ENUM ('pending','active','matured','broken','rolled_over','closed');
CREATE TYPE workflow_status AS ENUM ('pending','in_review','approved','rejected','escalated','cancelled','expired');
CREATE TYPE approval_action AS ENUM ('submit','approve','reject','escalate','cancel','resubmit');
CREATE TYPE notification_channel AS ENUM ('sms','email','push','in_app');
CREATE TYPE notification_status AS ENUM ('queued','sent','delivered','failed','bounced');
CREATE TYPE document_type AS ENUM ('national_id','passport','drivers_license','utility_bill','birth_certificate','business_reg','collateral_doc','loan_contract','account_form','statement','other');
CREATE TYPE ledger_entry_type AS ENUM ('debit','credit');
CREATE TYPE reconciliation_status AS ENUM ('unmatched','matched','partial','exception','cleared');
CREATE TYPE period_status AS ENUM ('open','closing','closed');
CREATE TYPE mobile_money_provider AS ENUM ('mtn_momo','vodafone_cash','airteltigo');
CREATE TYPE integration_status AS ENUM ('pending','success','failed','retrying');

-- ============================================================
-- BRANCHES
-- ============================================================
CREATE TABLE branches (
    branch_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_code     VARCHAR(10) NOT NULL UNIQUE,
    branch_name     VARCHAR(100) NOT NULL,
    region          VARCHAR(50),
    address         TEXT,
    phone           VARCHAR(20),
    email           VARCHAR(100),
    manager_user_id UUID,  -- FK added after users table
    is_head_office  BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- USERS & ACCESS
-- ============================================================
CREATE TABLE users (
    user_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username            VARCHAR(50) NOT NULL UNIQUE,
    email               VARCHAR(100) NOT NULL UNIQUE,
    password_hash       TEXT NOT NULL,
    full_name           VARCHAR(100) NOT NULL,
    role                user_role NOT NULL,
    branch_id           UUID REFERENCES branches(branch_id),
    status              user_status NOT NULL DEFAULT 'active',
    mfa_enabled         BOOLEAN NOT NULL DEFAULT FALSE,
    mfa_secret          TEXT,
    failed_login_count  INT NOT NULL DEFAULT 0,
    last_login_at       TIMESTAMPTZ,
    password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE branches ADD CONSTRAINT fk_branch_manager FOREIGN KEY (manager_user_id) REFERENCES users(user_id);

CREATE TABLE user_sessions (
    session_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id         UUID NOT NULL REFERENCES users(user_id),
    token_hash      TEXT NOT NULL,
    refresh_token_hash TEXT,
    ip_address      INET,
    device_fingerprint TEXT,
    user_agent      TEXT,
    expires_at      TIMESTAMPTZ NOT NULL,
    revoked_at      TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_mfa_attempts (
    attempt_id  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id     UUID NOT NULL REFERENCES users(user_id),
    otp_hash    TEXT NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL,
    used_at     TIMESTAMPTZ,
    ip_address  INET,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CUSTOMERS & KYC
-- ============================================================
CREATE TABLE customers (
    customer_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_number   VARCHAR(20) NOT NULL UNIQUE,
    full_name         VARCHAR(200) NOT NULL,
    date_of_birth     DATE,
    gender            VARCHAR(10),
    nationality       VARCHAR(50),
    id_type           VARCHAR(50),
    id_number         VARCHAR(50),
    id_expiry_date    DATE,
    kyc_tier          kyc_tier NOT NULL DEFAULT 'tier_1',
    kyc_status        kyc_status NOT NULL DEFAULT 'pending',
    risk_rating       risk_rating NOT NULL DEFAULT 'low',
    phone_number      VARCHAR(20) NOT NULL,
    alt_phone         VARCHAR(20),
    email             VARCHAR(100),
    address           TEXT,
    gps_address       VARCHAR(50),
    region            VARCHAR(50),
    occupation        VARCHAR(100),
    employer_name     VARCHAR(100),
    source_of_funds   TEXT,
    pep_flag          BOOLEAN NOT NULL DEFAULT FALSE,
    sanctions_flag    BOOLEAN NOT NULL DEFAULT FALSE,
    status            customer_status NOT NULL DEFAULT 'prospect',
    branch_id         UUID NOT NULL REFERENCES branches(branch_id),
    relationship_officer_id UUID REFERENCES users(user_id),
    portal_user_id    UUID REFERENCES users(user_id),
    created_by        UUID NOT NULL REFERENCES users(user_id),
    approved_by       UUID REFERENCES users(user_id),
    approved_at       TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_customer_id_number UNIQUE(id_type, id_number)
);

CREATE TABLE customer_kyc_documents (
    doc_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(customer_id),
    document_type   document_type NOT NULL,
    file_reference  TEXT NOT NULL,
    file_name       TEXT NOT NULL,
    file_size_bytes BIGINT,
    mime_type       VARCHAR(100),
    is_verified     BOOLEAN NOT NULL DEFAULT FALSE,
    verified_by     UUID REFERENCES users(user_id),
    verified_at     TIMESTAMPTZ,
    expiry_date     DATE,
    notes           TEXT,
    uploaded_by     UUID NOT NULL REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE kyc_screenings (
    screening_id    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    customer_id     UUID NOT NULL REFERENCES customers(customer_id),
    screening_type  VARCHAR(50) NOT NULL, -- 'pep', 'sanctions', 'aml'
    provider        VARCHAR(100),
    request_ref     VARCHAR(100),
    result          JSONB,
    status          VARCHAR(20) NOT NULL,
    screened_by     UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- PRODUCT CONFIGURATION
-- ============================================================
CREATE TABLE product_configs (
    config_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code        VARCHAR(20) NOT NULL,
    product_name        VARCHAR(100) NOT NULL,
    product_type        account_type NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'GHS',
    minimum_balance     BIGINT NOT NULL DEFAULT 0,
    minimum_opening     BIGINT NOT NULL DEFAULT 0,
    maximum_balance     BIGINT,
    interest_rate_pa    DECIMAL(10,6) NOT NULL DEFAULT 0,  -- annual rate, e.g. 0.12 = 12%
    interest_method     VARCHAR(20) NOT NULL DEFAULT 'daily_balance', -- 'daily_balance','minimum_balance','average_balance'
    interest_posting_freq VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'daily','monthly','quarterly','annually'
    min_tenor_days      INT,
    max_tenor_days      INT,
    early_breakage_penalty_rate DECIMAL(10,6) DEFAULT 0,
    allows_overdraft    BOOLEAN NOT NULL DEFAULT FALSE,
    overdraft_limit     BIGINT,
    kyc_tier_required   kyc_tier NOT NULL DEFAULT 'tier_1',
    max_daily_withdrawal BIGINT,
    max_single_withdrawal BIGINT,
    dormancy_days       INT NOT NULL DEFAULT 180,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    effective_from      DATE NOT NULL,
    effective_to        DATE,
    version             INT NOT NULL DEFAULT 1,
    created_by          UUID NOT NULL REFERENCES users(user_id),
    approved_by         UUID REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE fee_configs (
    fee_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code    VARCHAR(20) NOT NULL,
    fee_code        VARCHAR(30) NOT NULL,
    fee_name        VARCHAR(100) NOT NULL,
    fee_type        VARCHAR(20) NOT NULL, -- 'flat','percentage','tier'
    flat_amount     BIGINT,
    percentage_rate DECIMAL(10,6),
    min_amount      BIGINT,
    max_amount      BIGINT,
    tier_config     JSONB, -- [{from:0, to:1000, rate:0.01}, ...]
    gl_account_code VARCHAR(20),
    effective_from  DATE NOT NULL,
    effective_to    DATE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE approval_matrix (
    matrix_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_type   VARCHAR(50) NOT NULL,
    product_code    VARCHAR(20),
    min_amount      BIGINT NOT NULL DEFAULT 0,
    max_amount      BIGINT,
    required_role_1 user_role,
    required_role_2 user_role,
    required_role_3 user_role,
    sla_hours       INT NOT NULL DEFAULT 24,
    branch_id       UUID REFERENCES branches(branch_id), -- NULL = global
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_by      UUID NOT NULL REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE business_calendar (
    calendar_date   DATE PRIMARY KEY,
    is_working_day  BOOLEAN NOT NULL DEFAULT TRUE,
    holiday_name    VARCHAR(100),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- CHART OF ACCOUNTS
-- ============================================================
CREATE TABLE chart_of_accounts (
    account_code    VARCHAR(20) PRIMARY KEY,
    account_name    VARCHAR(100) NOT NULL,
    account_class   VARCHAR(20) NOT NULL, -- 'asset','liability','equity','income','expense'
    account_group   VARCHAR(50),
    parent_code     VARCHAR(20) REFERENCES chart_of_accounts(account_code),
    normal_balance  ledger_entry_type NOT NULL, -- 'debit' or 'credit'
    is_control      BOOLEAN NOT NULL DEFAULT FALSE,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    branch_id       UUID REFERENCES branches(branch_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TELLER CASH MANAGEMENT
-- ============================================================
CREATE TABLE teller_drawers (
    drawer_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    teller_user_id  UUID NOT NULL REFERENCES users(user_id),
    branch_id       UUID NOT NULL REFERENCES branches(branch_id),
    business_date   DATE NOT NULL,
    opening_balance BIGINT NOT NULL DEFAULT 0,
    closing_balance BIGINT,
    status          VARCHAR(20) NOT NULL DEFAULT 'open', -- 'open','balancing','closed'
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    UNIQUE(teller_user_id, business_date)
);

CREATE TABLE teller_drawer_movements (
    movement_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    drawer_id       UUID NOT NULL REFERENCES teller_drawers(drawer_id),
    movement_type   VARCHAR(20) NOT NULL, -- 'cash_in','cash_out','vault_in','vault_out'
    amount          BIGINT NOT NULL,
    reference       VARCHAR(50),
    authorized_by   UUID REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- ACCOUNTS
-- ============================================================
CREATE TABLE accounts (
    account_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_number      VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID REFERENCES customers(customer_id),
    product_code        VARCHAR(20) NOT NULL,
    account_type        account_type NOT NULL,
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    currency            VARCHAR(3) NOT NULL DEFAULT 'GHS',
    opening_balance     BIGINT NOT NULL DEFAULT 0,
    current_balance     BIGINT NOT NULL DEFAULT 0,    -- ledger balance
    available_balance   BIGINT NOT NULL DEFAULT 0,    -- current_balance - holds
    hold_amount         BIGINT NOT NULL DEFAULT 0,
    accrued_interest    BIGINT NOT NULL DEFAULT 0,
    status              account_status NOT NULL DEFAULT 'pending',
    opened_at           DATE NOT NULL DEFAULT CURRENT_DATE,
    last_transaction_at TIMESTAMPTZ,
    dormancy_notified   BOOLEAN NOT NULL DEFAULT FALSE,
    closed_at           DATE,
    close_reason        TEXT,
    mandate_type        VARCHAR(20) DEFAULT 'single', -- 'single','any_to_sign','all_to_sign'
    created_by          UUID NOT NULL REFERENCES users(user_id),
    approved_by         UUID REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_mandates (
    mandate_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID NOT NULL REFERENCES accounts(account_id),
    customer_id     UUID NOT NULL REFERENCES customers(customer_id),
    mandate_role    VARCHAR(20) NOT NULL DEFAULT 'signatory',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE account_holds (
    hold_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id      UUID NOT NULL REFERENCES accounts(account_id),
    amount          BIGINT NOT NULL,
    reason          TEXT NOT NULL,
    reference       VARCHAR(100),
    placed_by       UUID NOT NULL REFERENCES users(user_id),
    placed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at      TIMESTAMPTZ,
    released_at     TIMESTAMPTZ,
    released_by     UUID REFERENCES users(user_id)
);

-- ============================================================
-- TRANSACTIONS
-- ============================================================
CREATE TABLE transactions (
    transaction_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    transaction_ref     VARCHAR(50) NOT NULL UNIQUE,
    idempotency_key     VARCHAR(100) UNIQUE,
    transaction_type    transaction_type NOT NULL,
    channel             transaction_channel NOT NULL,
    source_account_id   UUID REFERENCES accounts(account_id),
    dest_account_id     UUID REFERENCES accounts(account_id),
    amount              BIGINT NOT NULL CHECK (amount > 0),
    fees                BIGINT NOT NULL DEFAULT 0,
    penalties           BIGINT NOT NULL DEFAULT 0,
    net_amount          BIGINT NOT NULL,
    currency            VARCHAR(3) NOT NULL DEFAULT 'GHS',
    narration           TEXT,
    status              transaction_status NOT NULL DEFAULT 'pending',
    business_date       DATE NOT NULL DEFAULT CURRENT_DATE,
    initiated_by        UUID NOT NULL REFERENCES users(user_id),
    approved_by         UUID REFERENCES users(user_id),
    approved_at         TIMESTAMPTZ,
    posted_at           TIMESTAMPTZ,
    reversal_of         UUID REFERENCES transactions(transaction_id),
    reversed_by         UUID REFERENCES transactions(transaction_id),
    provider_ref        VARCHAR(100),
    external_ref        VARCHAR(100),
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    drawer_id           UUID REFERENCES teller_drawers(drawer_id),
    customer_name_provided VARCHAR(200), -- for teller name verification
    name_match_confirmed   BOOLEAN,
    metadata            JSONB,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_txn_ref ON transactions(transaction_ref);
CREATE INDEX idx_txn_source ON transactions(source_account_id);
CREATE INDEX idx_txn_dest ON transactions(dest_account_id);
CREATE INDEX idx_txn_date ON transactions(business_date);
CREATE INDEX idx_txn_status ON transactions(status);
CREATE INDEX idx_txn_channel ON transactions(channel);
CREATE INDEX idx_txn_idempotency ON transactions(idempotency_key);

-- ============================================================
-- GENERAL LEDGER
-- ============================================================
CREATE TABLE accounting_periods (
    period_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    period_date     DATE NOT NULL UNIQUE,
    period_month    INT NOT NULL,
    period_year     INT NOT NULL,
    status          period_status NOT NULL DEFAULT 'open',
    closed_by       UUID REFERENCES users(user_id),
    closed_at       TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE journal_entries (
    journal_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_no      VARCHAR(30) NOT NULL UNIQUE,
    transaction_id  UUID REFERENCES transactions(transaction_id),
    posting_date    DATE NOT NULL,
    narration       TEXT NOT NULL,
    total_debits    BIGINT NOT NULL,
    total_credits   BIGINT NOT NULL,
    is_balanced     BOOLEAN GENERATED ALWAYS AS (total_debits = total_credits) STORED,
    period_id       UUID REFERENCES accounting_periods(period_id),
    posted_by       UUID NOT NULL REFERENCES users(user_id),
    is_reversal     BOOLEAN NOT NULL DEFAULT FALSE,
    reversal_of     UUID REFERENCES journal_entries(journal_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_balanced CHECK (total_debits = total_credits)
);

CREATE TABLE ledger_entries (
    entry_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    journal_id      UUID NOT NULL REFERENCES journal_entries(journal_id),
    account_code    VARCHAR(20) NOT NULL REFERENCES chart_of_accounts(account_code),
    entry_type      ledger_entry_type NOT NULL,
    amount          BIGINT NOT NULL CHECK (amount > 0),
    running_balance BIGINT,
    narration       TEXT,
    branch_id       UUID REFERENCES branches(branch_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_account ON ledger_entries(account_code);
CREATE INDEX idx_ledger_journal ON ledger_entries(journal_id);

-- GL account balances (materialized for performance)
CREATE TABLE gl_account_balances (
    balance_id      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_code    VARCHAR(20) NOT NULL REFERENCES chart_of_accounts(account_code),
    period_date     DATE NOT NULL,
    opening_balance BIGINT NOT NULL DEFAULT 0,
    total_debits    BIGINT NOT NULL DEFAULT 0,
    total_credits   BIGINT NOT NULL DEFAULT 0,
    closing_balance BIGINT NOT NULL DEFAULT 0,
    branch_id       UUID REFERENCES branches(branch_id),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(account_code, period_date, branch_id)
);

-- ============================================================
-- LOANS
-- ============================================================
CREATE TABLE loan_products (
    product_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    product_code        VARCHAR(20) NOT NULL UNIQUE,
    product_name        VARCHAR(100) NOT NULL,
    min_amount          BIGINT NOT NULL,
    max_amount          BIGINT NOT NULL,
    min_tenor_months    INT NOT NULL,
    max_tenor_months    INT NOT NULL,
    interest_rate_pa    DECIMAL(10,6) NOT NULL,
    interest_method     VARCHAR(20) NOT NULL DEFAULT 'reducing_balance', -- 'flat','reducing_balance'
    repayment_freq      VARCHAR(20) NOT NULL DEFAULT 'monthly', -- 'weekly','biweekly','monthly'
    grace_period_days   INT NOT NULL DEFAULT 0,
    penalty_rate_pd     DECIMAL(10,6) NOT NULL DEFAULT 0,  -- per day rate on overdue principal
    processing_fee_rate DECIMAL(10,6) NOT NULL DEFAULT 0,
    requires_collateral BOOLEAN NOT NULL DEFAULT FALSE,
    requires_guarantor  BOOLEAN NOT NULL DEFAULT FALSE,
    kyc_tier_required   kyc_tier NOT NULL DEFAULT 'tier_1',
    max_concurrent_loans INT NOT NULL DEFAULT 1,
    is_active           BOOLEAN NOT NULL DEFAULT TRUE,
    created_by          UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loans (
    loan_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_number         VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES customers(customer_id),
    product_code        VARCHAR(20) NOT NULL,
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    principal_amount    BIGINT NOT NULL,
    approved_amount     BIGINT,
    disbursed_amount    BIGINT,
    outstanding_principal BIGINT NOT NULL DEFAULT 0,
    accrued_interest    BIGINT NOT NULL DEFAULT 0,
    accrued_penalty     BIGINT NOT NULL DEFAULT 0,
    interest_rate_pa    DECIMAL(10,6) NOT NULL,
    interest_method     VARCHAR(20) NOT NULL DEFAULT 'reducing_balance',
    tenor_months        INT NOT NULL,
    repayment_frequency VARCHAR(20) NOT NULL DEFAULT 'monthly',
    grace_period_days   INT NOT NULL DEFAULT 0,
    purpose             TEXT,
    source_of_repayment TEXT,
    collateral_reference TEXT,
    guarantor_reference  TEXT,
    risk_grade          VARCHAR(5), -- 'A','B','C','D','E'
    credit_score        INT,
    status              loan_status NOT NULL DEFAULT 'draft',
    disbursement_account_id UUID REFERENCES accounts(account_id),
    disbursement_date   DATE,
    first_repayment_date DATE,
    maturity_date       DATE,
    last_repayment_date DATE,
    days_in_arrears     INT NOT NULL DEFAULT 0,
    times_restructured  INT NOT NULL DEFAULT 0,
    write_off_amount    BIGINT,
    write_off_date      DATE,
    loan_officer_id     UUID REFERENCES users(user_id),
    created_by          UUID NOT NULL REFERENCES users(user_id),
    submitted_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE loan_repayment_schedules (
    schedule_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id             UUID NOT NULL REFERENCES loans(loan_id),
    installment_no      INT NOT NULL,
    due_date            DATE NOT NULL,
    opening_balance     BIGINT NOT NULL,
    principal_due       BIGINT NOT NULL,
    interest_due        BIGINT NOT NULL,
    penalty_due         BIGINT NOT NULL DEFAULT 0,
    total_due           BIGINT NOT NULL,
    amount_paid         BIGINT NOT NULL DEFAULT 0,
    principal_paid      BIGINT NOT NULL DEFAULT 0,
    interest_paid       BIGINT NOT NULL DEFAULT 0,
    penalty_paid        BIGINT NOT NULL DEFAULT 0,
    closing_balance     BIGINT NOT NULL,
    payment_date        DATE,
    status              repayment_status NOT NULL DEFAULT 'scheduled',
    UNIQUE(loan_id, installment_no)
);

CREATE TABLE loan_collaterals (
    collateral_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    loan_id             UUID NOT NULL REFERENCES loans(loan_id),
    collateral_type     VARCHAR(50) NOT NULL, -- 'land','vehicle','savings','guarantor'
    description         TEXT NOT NULL,
    estimated_value     BIGINT NOT NULL,
    forced_sale_value   BIGINT,
    valuation_date      DATE,
    valuer_name         VARCHAR(100),
    document_reference  VARCHAR(100),
    status              VARCHAR(20) NOT NULL DEFAULT 'active',
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- FIXED DEPOSITS
-- ============================================================
CREATE TABLE fixed_deposits (
    fd_id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    fd_number           VARCHAR(20) NOT NULL UNIQUE,
    customer_id         UUID NOT NULL REFERENCES customers(customer_id),
    source_account_id   UUID NOT NULL REFERENCES accounts(account_id),
    product_code        VARCHAR(20) NOT NULL,
    principal_amount    BIGINT NOT NULL,
    interest_rate_pa    DECIMAL(10,6) NOT NULL,
    tenor_days          INT NOT NULL,
    placement_date      DATE NOT NULL,
    maturity_date       DATE NOT NULL,
    maturity_value      BIGINT NOT NULL,
    accrued_interest    BIGINT NOT NULL DEFAULT 0,
    auto_rollover       BOOLEAN NOT NULL DEFAULT FALSE,
    rollover_count      INT NOT NULL DEFAULT 0,
    maturity_instruction VARCHAR(20) NOT NULL DEFAULT 'payout', -- 'payout','rollover','rollover_with_interest'
    payout_account_id   UUID REFERENCES accounts(account_id),
    status              fd_status NOT NULL DEFAULT 'pending',
    broken_at           DATE,
    breakage_penalty    BIGINT,
    break_reason        TEXT,
    notice_sent         BOOLEAN NOT NULL DEFAULT FALSE,
    notice_sent_at      TIMESTAMPTZ,
    branch_id           UUID NOT NULL REFERENCES branches(branch_id),
    created_by          UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INTEREST ACCRUALS
-- ============================================================
CREATE TABLE interest_accruals (
    accrual_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    accrual_date        DATE NOT NULL,
    account_id          UUID REFERENCES accounts(account_id),
    loan_id             UUID REFERENCES loans(loan_id),
    fd_id               UUID REFERENCES fixed_deposits(fd_id),
    product_code        VARCHAR(20) NOT NULL,
    balance_snapshot    BIGINT NOT NULL,
    rate_applied        DECIMAL(10,6) NOT NULL,
    days               INT NOT NULL DEFAULT 1,
    accrued_amount      BIGINT NOT NULL,
    posted_to_journal   BOOLEAN NOT NULL DEFAULT FALSE,
    journal_id          UUID REFERENCES journal_entries(journal_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(accrual_date, account_id),
    UNIQUE(accrual_date, loan_id),
    UNIQUE(accrual_date, fd_id)
);

-- ============================================================
-- WORKFLOWS & APPROVALS
-- ============================================================
CREATE TABLE workflow_requests (
    request_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_ref         VARCHAR(30) NOT NULL UNIQUE,
    workflow_type       VARCHAR(50) NOT NULL, -- 'account_open','loan_disburse','withdrawal','fd_break', etc.
    entity_type         VARCHAR(50) NOT NULL, -- 'account','loan','transaction','customer'
    entity_id           UUID NOT NULL,
    amount              BIGINT,
    requestor_id        UUID NOT NULL REFERENCES users(user_id),
    current_approver_role user_role,
    current_step        INT NOT NULL DEFAULT 1,
    total_steps         INT NOT NULL DEFAULT 1,
    status              workflow_status NOT NULL DEFAULT 'pending',
    priority            INT NOT NULL DEFAULT 5, -- 1=critical, 5=normal
    sla_deadline        TIMESTAMPTZ,
    escalated_at        TIMESTAMPTZ,
    completed_at        TIMESTAMPTZ,
    notes               TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE workflow_actions (
    action_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_id          UUID NOT NULL REFERENCES workflow_requests(request_id),
    step_no             INT NOT NULL,
    action              approval_action NOT NULL,
    actor_id            UUID NOT NULL REFERENCES users(user_id),
    actor_role          user_role NOT NULL,
    notes               TEXT,
    ip_address          INET,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- MOBILE MONEY INTEGRATION
-- ============================================================
CREATE TABLE mobile_money_transactions (
    mm_txn_id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    internal_ref        VARCHAR(50) NOT NULL UNIQUE,
    provider            mobile_money_provider NOT NULL,
    provider_ref        VARCHAR(100),
    wallet_number       VARCHAR(20) NOT NULL,
    direction           VARCHAR(10) NOT NULL, -- 'inbound','outbound'
    amount              BIGINT NOT NULL,
    charges             BIGINT NOT NULL DEFAULT 0,
    status              integration_status NOT NULL DEFAULT 'pending',
    callback_received   BOOLEAN NOT NULL DEFAULT FALSE,
    callback_data       JSONB,
    retry_count         INT NOT NULL DEFAULT 0,
    linked_transaction_id UUID REFERENCES transactions(transaction_id),
    settlement_id       UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settlement_files (
    settlement_id       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    provider            VARCHAR(50) NOT NULL,
    settlement_date     DATE NOT NULL,
    file_reference      TEXT,
    total_count         INT NOT NULL DEFAULT 0,
    total_amount        BIGINT NOT NULL DEFAULT 0,
    matched_count       INT NOT NULL DEFAULT 0,
    unmatched_count     INT NOT NULL DEFAULT 0,
    imported_by         UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE settlement_items (
    item_id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    settlement_id       UUID NOT NULL REFERENCES settlement_files(settlement_id),
    provider_ref        VARCHAR(100) NOT NULL,
    wallet_number       VARCHAR(20),
    amount              BIGINT NOT NULL,
    direction           VARCHAR(10),
    transaction_date    TIMESTAMPTZ,
    reconciliation_status reconciliation_status NOT NULL DEFAULT 'unmatched',
    matched_txn_id      UUID REFERENCES transactions(transaction_id),
    exception_note      TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- RECONCILIATION
-- ============================================================
CREATE TABLE reconciliation_sessions (
    session_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_date        DATE NOT NULL,
    session_type        VARCHAR(30) NOT NULL, -- 'cash','bank','mobile_money','gl'
    branch_id           UUID REFERENCES branches(branch_id),
    status              VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    system_total        BIGINT,
    external_total      BIGINT,
    variance            BIGINT,
    matched_count       INT NOT NULL DEFAULT 0,
    exception_count     INT NOT NULL DEFAULT 0,
    performed_by        UUID NOT NULL REFERENCES users(user_id),
    reviewed_by         UUID REFERENCES users(user_id),
    completed_at        TIMESTAMPTZ,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE reconciliation_exceptions (
    exception_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id          UUID NOT NULL REFERENCES reconciliation_sessions(session_id),
    exception_type      VARCHAR(30) NOT NULL,
    reference           VARCHAR(100),
    amount              BIGINT,
    description         TEXT,
    resolution_status   VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_by         UUID REFERENCES users(user_id),
    resolved_at         TIMESTAMPTZ,
    suspense_account    VARCHAR(20) REFERENCES chart_of_accounts(account_code),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
CREATE TABLE notifications (
    notification_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_user_id   UUID REFERENCES users(user_id),
    recipient_customer_id UUID REFERENCES customers(customer_id),
    channel             notification_channel NOT NULL,
    recipient_address   TEXT NOT NULL, -- phone or email
    template_code       VARCHAR(50) NOT NULL,
    subject             TEXT,
    body                TEXT NOT NULL,
    status              notification_status NOT NULL DEFAULT 'queued',
    provider_ref        VARCHAR(100),
    retry_count         INT NOT NULL DEFAULT 0,
    sent_at             TIMESTAMPTZ,
    delivered_at        TIMESTAMPTZ,
    failed_reason       TEXT,
    related_entity_type VARCHAR(50),
    related_entity_id   UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- DOCUMENTS
-- ============================================================
CREATE TABLE documents (
    document_id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_type       document_type NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           UUID NOT NULL,
    file_reference      TEXT NOT NULL,
    file_name           TEXT NOT NULL,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(100),
    checksum            VARCHAR(64),
    is_virus_scanned    BOOLEAN NOT NULL DEFAULT FALSE,
    virus_scan_result   VARCHAR(20),
    access_level        VARCHAR(20) NOT NULL DEFAULT 'internal',
    uploaded_by         UUID NOT NULL REFERENCES users(user_id),
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- AUDIT LOGS — APPEND ONLY, IMMUTABLE
-- ============================================================
CREATE TABLE audit_logs (
    audit_id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    actor_user_id       UUID NOT NULL REFERENCES users(user_id),
    actor_role          user_role NOT NULL,
    action_type         VARCHAR(50) NOT NULL,
    entity_type         VARCHAR(50) NOT NULL,
    entity_id           VARCHAR(100),
    before_value        JSONB,
    after_value         JSONB,
    reason_code         VARCHAR(50),
    description         TEXT,
    ip_address          INET,
    device_fingerprint  TEXT,
    user_agent          TEXT,
    session_id          UUID,
    branch_id           UUID,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_actor ON audit_logs(actor_user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date ON audit_logs(created_at);
CREATE INDEX idx_audit_action ON audit_logs(action_type);

-- Prevent updates/deletes on audit_logs
CREATE RULE no_update_audit AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE no_delete_audit AS ON DELETE TO audit_logs DO INSTEAD NOTHING;

-- ============================================================
-- REPORTS (cached/scheduled report results)
-- ============================================================
CREATE TABLE report_runs (
    run_id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_type     VARCHAR(50) NOT NULL,
    parameters      JSONB NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'queued',
    file_reference  TEXT,
    file_format     VARCHAR(10),
    row_count       INT,
    requested_by    UUID NOT NULL REFERENCES users(user_id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error_message   TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- SUSPENSE ACCOUNTS TRACKER
-- ============================================================
CREATE TABLE suspense_entries (
    suspense_id     UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reference       VARCHAR(100) NOT NULL,
    amount          BIGINT NOT NULL,
    reason          TEXT NOT NULL,
    gl_account_code VARCHAR(20) REFERENCES chart_of_accounts(account_code),
    linked_txn_id   UUID REFERENCES transactions(transaction_id),
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    resolved_by     UUID REFERENCES users(user_id),
    resolved_at     TIMESTAMPTZ,
    created_by      UUID NOT NULL REFERENCES users(user_id),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- COMPLIANCE ALERTS
-- ============================================================
CREATE TABLE compliance_alerts (
    alert_id        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    alert_type      VARCHAR(50) NOT NULL, -- 'high_value','pep_match','sanctions','suspicious'
    severity        VARCHAR(10) NOT NULL DEFAULT 'medium',
    entity_type     VARCHAR(50),
    entity_id       UUID,
    customer_id     UUID REFERENCES customers(customer_id),
    transaction_id  UUID REFERENCES transactions(transaction_id),
    description     TEXT NOT NULL,
    status          VARCHAR(20) NOT NULL DEFAULT 'open',
    assigned_to     UUID REFERENCES users(user_id),
    resolved_by     UUID REFERENCES users(user_id),
    resolved_at     TIMESTAMPTZ,
    resolution_notes TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================
CREATE INDEX idx_customers_number ON customers(customer_number);
CREATE INDEX idx_customers_phone ON customers(phone_number);
CREATE INDEX idx_customers_id_number ON customers(id_number);
CREATE INDEX idx_accounts_number ON accounts(account_number);
CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_loans_customer ON loans(customer_id);
CREATE INDEX idx_loans_number ON loans(loan_number);
CREATE INDEX idx_loans_status ON loans(status);
CREATE INDEX idx_fd_customer ON fixed_deposits(customer_id);
CREATE INDEX idx_repayments_loan ON loan_repayment_schedules(loan_id, due_date);
CREATE INDEX idx_workflow_status ON workflow_requests(status);
CREATE INDEX idx_workflow_entity ON workflow_requests(entity_type, entity_id);
CREATE INDEX idx_notifications_status ON notifications(status);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_accounts_updated BEFORE UPDATE ON accounts FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_transactions_updated BEFORE UPDATE ON transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_loans_updated BEFORE UPDATE ON loans FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_fd_updated BEFORE UPDATE ON fixed_deposits FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER trg_workflow_updated BEFORE UPDATE ON workflow_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Generate sequential customer number
CREATE SEQUENCE customer_number_seq START 100001;
CREATE OR REPLACE FUNCTION generate_customer_number() RETURNS TEXT AS $$
BEGIN RETURN 'GTL' || LPAD(NEXTVAL('customer_number_seq')::TEXT, 7, '0'); END;
$$ LANGUAGE plpgsql;

-- Generate account number
CREATE SEQUENCE account_number_seq START 1000000001;
CREATE OR REPLACE FUNCTION generate_account_number() RETURNS TEXT AS $$
BEGIN RETURN LPAD(NEXTVAL('account_number_seq')::TEXT, 10, '0'); END;
$$ LANGUAGE plpgsql;

-- Generate loan number
CREATE SEQUENCE loan_number_seq START 10001;
CREATE OR REPLACE FUNCTION generate_loan_number() RETURNS TEXT AS $$
BEGIN RETURN 'LN' || TO_CHAR(NOW(), 'YY') || LPAD(NEXTVAL('loan_number_seq')::TEXT, 6, '0'); END;
$$ LANGUAGE plpgsql;

-- Generate FD number
CREATE SEQUENCE fd_number_seq START 10001;
CREATE OR REPLACE FUNCTION generate_fd_number() RETURNS TEXT AS $$
BEGIN RETURN 'FD' || TO_CHAR(NOW(), 'YY') || LPAD(NEXTVAL('fd_number_seq')::TEXT, 6, '0'); END;
$$ LANGUAGE plpgsql;

-- Generate journal number
CREATE SEQUENCE journal_seq START 1;
CREATE OR REPLACE FUNCTION generate_journal_no() RETURNS TEXT AS $$
BEGIN RETURN 'JNL' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(NEXTVAL('journal_seq')::TEXT, 6, '0'); END;
$$ LANGUAGE plpgsql;

-- Generate transaction reference
CREATE SEQUENCE txn_ref_seq START 1;
CREATE OR REPLACE FUNCTION generate_txn_ref() RETURNS TEXT AS $$
BEGIN RETURN 'TXN' || TO_CHAR(NOW(), 'YYYYMMDD') || LPAD(NEXTVAL('txn_ref_seq')::TEXT, 8, '0'); END;
$$ LANGUAGE plpgsql;

-- Validate journal balance before insert
CREATE OR REPLACE FUNCTION validate_journal_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_debits BIGINT;
    v_credits BIGINT;
BEGIN
    SELECT COALESCE(SUM(CASE WHEN entry_type='debit' THEN amount ELSE 0 END), 0),
           COALESCE(SUM(CASE WHEN entry_type='credit' THEN amount ELSE 0 END), 0)
    INTO v_debits, v_credits
    FROM ledger_entries WHERE journal_id = NEW.journal_id;

    IF v_debits <> v_credits THEN
        RAISE EXCEPTION 'Unbalanced journal: debits=% credits=%', v_debits, v_credits;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Prevent posting to closed accounts
CREATE OR REPLACE FUNCTION prevent_closed_account_posting()
RETURNS TRIGGER AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM accounts
        WHERE account_id IN (NEW.source_account_id, NEW.dest_account_id)
        AND status IN ('closed','frozen') AND account_type NOT IN ('suspense','gl_control')
    ) THEN
        RAISE EXCEPTION 'Cannot post to a closed or frozen account';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prevent_closed_posting
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION prevent_closed_account_posting();
