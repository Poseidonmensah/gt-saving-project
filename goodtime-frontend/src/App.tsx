import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';

// Layouts
import { AppLayout } from '@components/layout/AppLayout';
import { AuthLayout } from '@components/layout/AuthLayout';

// Auth pages
import { LoginPage } from '@pages/auth/LoginPage';
import { MfaPage } from '@pages/auth/MfaPage';
import { ChangePasswordPage } from '@pages/auth/ChangePasswordPage';

// Dashboard
import { DashboardPage } from '@pages/dashboard/DashboardPage';

// Customers
import { CustomersListPage } from '@pages/customers/CustomersListPage';
import { CustomerDetailPage } from '@pages/customers/CustomerDetailPage';
import { CustomerCreatePage } from '@pages/customers/CustomerCreatePage';
import { KycReviewPage } from '@pages/customers/KycReviewPage';

// Accounts
import { AccountsPage } from '@pages/accounts/AccountsPage';
import { AccountDetailPage } from '@pages/accounts/AccountDetailPage';
import { AccountStatementPage } from '@pages/accounts/AccountStatementPage';

// Teller
import { TellerDashboard } from '@pages/teller/TellerDashboard';
import { TellerDepositPage } from '@pages/teller/TellerDepositPage';
import { TellerWithdrawalPage } from '@pages/teller/TellerWithdrawalPage';
import { DrawerManagementPage } from '@pages/teller/DrawerManagementPage';

// Loans
import { LoansListPage } from '@pages/loans/LoansListPage';
import { LoanDetailPage } from '@pages/loans/LoanDetailPage';
import { LoanApplicationPage } from '@pages/loans/LoanApplicationPage';
import { LoanRepaymentPage } from '@pages/loans/LoanRepaymentPage';
import { LoanPortfolioPage } from '@pages/loans/LoanPortfolioPage';

// Fixed Deposits
import { FixedDepositsPage } from '@pages/fixed-deposits/FixedDepositsPage';
import { FDPlacementPage } from '@pages/fixed-deposits/FDPlacementPage';
import { FDDetailPage } from '@pages/fixed-deposits/FDDetailPage';

// Ledger
import { TrialBalancePage } from '@pages/ledger/TrialBalancePage';
import { ChartOfAccountsPage } from '@pages/ledger/ChartOfAccountsPage';
import { JournalEntryPage } from '@pages/ledger/JournalEntryPage';
import { GLLedgerPage } from '@pages/ledger/GLLedgerPage';

// Reconciliation
import { ReconciliationPage } from '@pages/reconciliation/ReconciliationPage';
import { CashReconciliationPage } from '@pages/reconciliation/CashReconciliationPage';
import { MobileMoneyReconciliationPage } from '@pages/reconciliation/MobileMoneyReconciliationPage';

// Reports
import { ReportsPage } from '@pages/reports/ReportsPage';

// Workflow
import { WorkflowQueuePage } from '@pages/workflow/WorkflowQueuePage';
import { WorkflowDetailPage } from '@pages/workflow/WorkflowDetailPage';

// Admin
import { UsersManagementPage } from '@pages/admin/UsersManagementPage';
import { ProductConfigPage } from '@pages/admin/ProductConfigPage';
import { FeeConfigPage } from '@pages/admin/FeeConfigPage';
import { ApprovalMatrixPage } from '@pages/admin/ApprovalMatrixPage';
import { BranchManagementPage } from '@pages/admin/BranchManagementPage';

// Audit
import { AuditLogsPage } from '@pages/audit/AuditLogsPage';

// Customer Portal
import { PortalDashboard } from '@pages/portal/PortalDashboard';
import { PortalAccountsPage } from '@pages/portal/PortalAccountsPage';
import { PortalLoansPage } from '@pages/portal/PortalLoansPage';

// Role-based route guard
function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { user, isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (user?.mustChangePassword) return <Navigate to="/change-password" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/unauthorized" replace />;
  return <>{children}</>;
}

function RequireGuest({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const STAFF_ROLES = ['super_admin','admin','branch_manager','teller','loan_officer','credit_analyst','accountant','auditor','compliance_officer','customer_care'];
const ADMIN_ROLES = ['super_admin','admin'];
const MANAGER_ROLES = ['super_admin','admin','branch_manager'];
const TELLER_ROLES = ['super_admin','admin','branch_manager','teller'];
const LOAN_ROLES = ['super_admin','admin','branch_manager','loan_officer','credit_analyst'];
const FINANCE_ROLES = ['super_admin','admin','accountant'];
const AUDIT_ROLES = ['super_admin','admin','auditor','compliance_officer'];
const COMPLIANCE_ROLES = ['super_admin','admin','compliance_officer'];

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth routes */}
        <Route element={<AuthLayout />}>
          <Route path="/login" element={<RequireGuest><LoginPage /></RequireGuest>} />
          <Route path="/mfa" element={<MfaPage />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>

        {/* Main app routes */}
        <Route element={<RequireAuth roles={STAFF_ROLES}><AppLayout /></RequireAuth>}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />

          {/* Customers */}
          <Route path="/customers" element={<CustomersListPage />} />
          <Route path="/customers/new" element={<CustomerCreatePage />} />
          <Route path="/customers/:customerId" element={<CustomerDetailPage />} />
          <Route path="/customers/:customerId/kyc" element={<RequireAuth roles={COMPLIANCE_ROLES}><KycReviewPage /></RequireAuth>} />

          {/* Accounts */}
          <Route path="/accounts" element={<AccountsPage />} />
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
          <Route path="/accounts/:accountId/statement" element={<AccountStatementPage />} />

          {/* Teller */}
          <Route path="/teller" element={<RequireAuth roles={TELLER_ROLES}><TellerDashboard /></RequireAuth>} />
          <Route path="/teller/deposit" element={<RequireAuth roles={TELLER_ROLES}><TellerDepositPage /></RequireAuth>} />
          <Route path="/teller/withdrawal" element={<RequireAuth roles={TELLER_ROLES}><TellerWithdrawalPage /></RequireAuth>} />
          <Route path="/teller/drawer" element={<RequireAuth roles={TELLER_ROLES}><DrawerManagementPage /></RequireAuth>} />

          {/* Loans */}
          <Route path="/loans" element={<LoansListPage />} />
          <Route path="/loans/portfolio" element={<RequireAuth roles={LOAN_ROLES}><LoanPortfolioPage /></RequireAuth>} />
          <Route path="/loans/new" element={<RequireAuth roles={LOAN_ROLES}><LoanApplicationPage /></RequireAuth>} />
          <Route path="/loans/:loanId" element={<LoanDetailPage />} />
          <Route path="/loans/:loanId/repayment" element={<RequireAuth roles={TELLER_ROLES}><LoanRepaymentPage /></RequireAuth>} />

          {/* Fixed Deposits */}
          <Route path="/fixed-deposits" element={<FixedDepositsPage />} />
          <Route path="/fixed-deposits/new" element={<RequireAuth roles={TELLER_ROLES}><FDPlacementPage /></RequireAuth>} />
          <Route path="/fixed-deposits/:fdId" element={<FDDetailPage />} />

          {/* General Ledger */}
          <Route path="/ledger/trial-balance" element={<RequireAuth roles={FINANCE_ROLES}><TrialBalancePage /></RequireAuth>} />
          <Route path="/ledger/chart-of-accounts" element={<RequireAuth roles={FINANCE_ROLES}><ChartOfAccountsPage /></RequireAuth>} />
          <Route path="/ledger/journals" element={<RequireAuth roles={FINANCE_ROLES}><JournalEntryPage /></RequireAuth>} />
          <Route path="/ledger/:accountCode" element={<RequireAuth roles={FINANCE_ROLES}><GLLedgerPage /></RequireAuth>} />

          {/* Reconciliation */}
          <Route path="/reconciliation" element={<RequireAuth roles={FINANCE_ROLES}><ReconciliationPage /></RequireAuth>} />
          <Route path="/reconciliation/cash" element={<RequireAuth roles={FINANCE_ROLES}><CashReconciliationPage /></RequireAuth>} />
          <Route path="/reconciliation/mobile-money" element={<RequireAuth roles={FINANCE_ROLES}><MobileMoneyReconciliationPage /></RequireAuth>} />

          {/* Reports */}
          <Route path="/reports" element={<RequireAuth roles={[...FINANCE_ROLES, ...MANAGER_ROLES, 'auditor', 'compliance_officer']}><ReportsPage /></RequireAuth>} />

          {/* Workflow */}
          <Route path="/workflow" element={<WorkflowQueuePage />} />
          <Route path="/workflow/:requestId" element={<WorkflowDetailPage />} />

          {/* Admin */}
          <Route path="/admin/users" element={<RequireAuth roles={ADMIN_ROLES}><UsersManagementPage /></RequireAuth>} />
          <Route path="/admin/products" element={<RequireAuth roles={ADMIN_ROLES}><ProductConfigPage /></RequireAuth>} />
          <Route path="/admin/fees" element={<RequireAuth roles={ADMIN_ROLES}><FeeConfigPage /></RequireAuth>} />
          <Route path="/admin/approval-matrix" element={<RequireAuth roles={ADMIN_ROLES}><ApprovalMatrixPage /></RequireAuth>} />
          <Route path="/admin/branches" element={<RequireAuth roles={ADMIN_ROLES}><BranchManagementPage /></RequireAuth>} />

          {/* Audit */}
          <Route path="/audit" element={<RequireAuth roles={AUDIT_ROLES}><AuditLogsPage /></RequireAuth>} />
        </Route>

        {/* Customer Self-Service Portal */}
        <Route element={<RequireAuth roles={['customer']}><AppLayout isPortal /></RequireAuth>}>
          <Route path="/portal" element={<PortalDashboard />} />
          <Route path="/portal/accounts" element={<PortalAccountsPage />} />
          <Route path="/portal/loans" element={<PortalLoansPage />} />
        </Route>

        <Route path="/unauthorized" element={<div className="flex items-center justify-center h-screen text-red-500 text-xl">Access Denied</div>} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
