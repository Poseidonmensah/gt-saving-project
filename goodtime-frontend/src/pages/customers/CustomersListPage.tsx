// ============================================================
// src/pages/customers/CustomersListPage.tsx
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Search, Plus, Filter, UserCheck, AlertTriangle } from 'lucide-react';

export function CustomersListPage() {
  const [search, setSearch] = useState({ fullName: '', phoneNumber: '', customerNumber: '', status: '' });
  const [page, setPage] = useState(1);
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken;

  const { data, isLoading } = useQuery({
    queryKey: ['customers', search, page],
    queryFn: () => fetch(`/api/v1/customers?${new URLSearchParams({ ...search, page: String(page), limit: '20' })}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(r => r.data),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'badge-green', prospect: 'badge-blue', frozen: 'badge-red',
      restricted: 'badge-orange', dormant: 'badge-yellow', closed: 'badge-gray',
    };
    return <span className={map[status] || 'badge-gray'}>{status}</span>;
  };

  const kycBadge = (status: string) => {
    const map: Record<string, string> = { approved: 'badge-green', pending: 'badge-yellow', rejected: 'badge-red', in_review: 'badge-blue' };
    return <span className={map[status] || 'badge-gray'}>{status}</span>;
  };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customers</h1>
          <p className="page-subtitle">Search and manage customer records</p>
        </div>
        <Link to="/customers/new" className="btn-primary">
          <Plus size={16} /> New Customer
        </Link>
      </div>

      {/* Search bar */}
      <div className="card p-4">
        <div className="grid grid-cols-4 gap-3">
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input className="input pl-9" placeholder="Customer name..." value={search.fullName} onChange={e => { setSearch(s => ({ ...s, fullName: e.target.value })); setPage(1); }} />
          </div>
          <input className="input font-mono" placeholder="Phone number..." value={search.phoneNumber} onChange={e => { setSearch(s => ({ ...s, phoneNumber: e.target.value })); setPage(1); }} />
          <input className="input font-mono" placeholder="Customer number..." value={search.customerNumber} onChange={e => { setSearch(s => ({ ...s, customerNumber: e.target.value })); setPage(1); }} />
          <select className="input" value={search.status} onChange={e => { setSearch(s => ({ ...s, status: e.target.value })); setPage(1); }}>
            <option value="">All Statuses</option>
            <option value="prospect">Prospect</option>
            <option value="active">Active</option>
            <option value="dormant">Dormant</option>
            <option value="frozen">Frozen</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="table-container">
        <table className="data-table">
          <thead><tr>
            <th>Customer No.</th><th>Full Name</th><th>Phone</th>
            <th>KYC Status</th><th>Status</th><th>Risk</th>
            <th>Branch</th><th>Joined</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={9} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : (data?.data || []).length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">No customers found</td></tr>
            ) : (data?.data || []).map((c: any) => (
              <tr key={c.customerId}>
                <td><span className="font-mono text-blue-700 font-semibold">{c.customerNumber}</span></td>
                <td>
                  <div className="flex items-center gap-2">
                    {c.pepFlag && <AlertTriangle size={13} className="text-red-500" title="PEP Flagged" />}
                    {c.sanctionsFlag && <AlertTriangle size={13} className="text-red-700" title="Sanctions Flagged" />}
                    <span className="font-medium">{c.fullName}</span>
                  </div>
                </td>
                <td className="font-mono">{c.phoneNumber}</td>
                <td>{kycBadge(c.kycStatus)}</td>
                <td>{statusBadge(c.status)}</td>
                <td><span className={`badge ${c.riskRating === 'high' ? 'badge-red' : c.riskRating === 'medium' ? 'badge-yellow' : 'badge-green'}`}>{c.riskRating}</span></td>
                <td className="text-slate-500 text-xs">{c.branchId?.slice(0, 8)}</td>
                <td className="text-slate-500 text-xs">{new Date(c.createdAt).toLocaleDateString('en-GH')}</td>
                <td>
                  <Link to={`/customers/${c.customerId}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data?.meta && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {((page - 1) * 20) + 1}–{Math.min(page * 20, data.meta.total)} of {data.meta.total}</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="btn-secondary btn-sm">Previous</button>
            <button onClick={() => setPage(p => p + 1)} disabled={page * 20 >= data.meta.total} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// src/pages/loans/LoansListPage.tsx
// ============================================================
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';

export function LoansListPage() {
  const { user } = useAuthStore();
  const [filters, setFilters] = useState({ status: '', loanNumber: '', page: 1 });
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken;

  const { data, isLoading } = useQuery({
    queryKey: ['loans', filters],
    queryFn: () => fetch(`/api/v1/loans?${new URLSearchParams({ ...filters, page: String(filters.page), limit: '25' })}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(r => r.data),
  });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      active: 'badge-green', approved: 'badge-blue', submitted: 'badge-blue',
      in_arrears: 'badge-yellow', default: 'badge-red', closed: 'badge-gray',
      draft: 'badge-gray', disbursed: 'badge-green', written_off: 'badge-red',
    };
    return <span className={map[status] || 'badge-gray'}>{status.replace(/_/g, ' ')}</span>;
  };

  const canCreateLoan = ['loan_officer','branch_manager','admin','super_admin'].includes(user?.role || '');

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Loan Management</h1>
          <p className="page-subtitle">Manage loan applications and active portfolio</p>
        </div>
        {canCreateLoan && (
          <Link to="/loans/new" className="btn-primary"><Plus size={16} /> New Application</Link>
        )}
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3">
          <input className="input font-mono" placeholder="Loan number..." value={filters.loanNumber}
            onChange={e => setFilters(f => ({ ...f, loanNumber: e.target.value, page: 1 }))} />
          <select className="input" value={filters.status} onChange={e => setFilters(f => ({ ...f, status: e.target.value, page: 1 }))}>
            <option value="">All Statuses</option>
            {['draft','submitted','under_review','approved','active','in_arrears','default','closed','written_off'].map(s => (
              <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            Total: <strong>{data?.meta?.total || 0}</strong> loans
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr>
            <th>Loan No.</th><th>Customer</th><th>Product</th><th>Principal (GHS)</th>
            <th>Outstanding</th><th>Rate</th><th>Status</th><th>Days Arrears</th>
            <th>Grade</th><th>Maturity</th><th></th>
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={11} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : (data?.data || []).map((loan: any) => (
              <tr key={loan.loanId}>
                <td><span className="font-mono text-blue-700 font-semibold text-xs">{loan.loanNumber}</span></td>
                <td className="text-xs">{loan.customerId?.slice(0, 8)}...</td>
                <td><span className="badge-blue">{loan.productCode}</span></td>
                <td className="money">{(Number(loan.principalAmount) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                <td className="money font-semibold">{(Number(loan.outstandingPrincipal) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}</td>
                <td className="text-center">{(parseFloat(loan.interestRatePa) * 100).toFixed(1)}%</td>
                <td>{statusBadge(loan.status)}</td>
                <td className="text-center">
                  {loan.daysInArrears > 0 ? (
                    <span className={`font-semibold ${loan.daysInArrears >= 90 ? 'text-red-600' : loan.daysInArrears >= 30 ? 'text-amber-600' : 'text-orange-500'}`}>
                      {loan.daysInArrears}
                    </span>
                  ) : <span className="text-emerald-500">—</span>}
                </td>
                <td className="text-center">
                  {loan.riskGrade && <span className={`font-bold ${loan.riskGrade === 'E' ? 'text-red-600' : loan.riskGrade === 'A' ? 'text-emerald-600' : 'text-slate-700'}`}>{loan.riskGrade}</span>}
                </td>
                <td className="text-xs text-slate-500">{loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-GH') : '—'}</td>
                <td>
                  <Link to={`/loans/${loan.loanId}`} className="text-blue-600 hover:text-blue-800 text-sm font-medium">View</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ============================================================
// src/pages/loans/LoanDetailPage.tsx
// ============================================================
import { useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, XCircle, Send, DollarSign, Calendar } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import toast from 'react-hot-toast';

export function LoanDetailPage() {
  const { loanId } = useParams<{ loanId: string }>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken;

  const headers = { Authorization: `Bearer ${token}` };

  const { data: loan, isLoading } = useQuery({
    queryKey: ['loan', loanId],
    queryFn: () => fetch(`/api/v1/loans/${loanId}`, { headers }).then(r => r.json()).then(r => r.data),
  });

  const { data: schedule } = useQuery({
    queryKey: ['loan-schedule', loanId],
    queryFn: () => fetch(`/api/v1/loans/${loanId}/schedule`, { headers }).then(r => r.json()).then(r => r.data),
    enabled: !!loan && ['active','in_arrears','closed'].includes(loan?.status),
  });

  const approve = useMutation({
    mutationFn: () => fetch(`/api/v1/loans/${loanId}/approve`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({}) }).then(r => r.json()),
    onSuccess: () => { toast.success('Loan approved'); qc.invalidateQueries({ queryKey: ['loan', loanId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const disburse = useMutation({
    mutationFn: () => fetch(`/api/v1/loans/${loanId}/disburse`, { method: 'POST', headers }).then(r => r.json()),
    onSuccess: () => { toast.success('Loan disbursed successfully'); qc.invalidateQueries({ queryKey: ['loan', loanId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const submit = useMutation({
    mutationFn: () => fetch(`/api/v1/loans/${loanId}/submit`, { method: 'POST', headers }).then(r => r.json()),
    onSuccess: () => { toast.success('Loan submitted for review'); qc.invalidateQueries({ queryKey: ['loan', loanId] }); },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full" /></div>;
  if (!loan) return <div className="text-center py-20 text-slate-400">Loan not found</div>;

  const fmtGHS = (v: any) => `GHS ${(Number(v) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`;

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="page-header">
        <div>
          <h1 className="page-title font-mono">{loan.loanNumber}</h1>
          <p className="page-subtitle capitalize">{loan.status.replace(/_/g, ' ')} · {loan.productCode}</p>
        </div>
        <div className="flex gap-2">
          {loan.status === 'draft' && (
            <button onClick={() => submit.mutate()} disabled={submit.isPending} className="btn-primary"><Send size={15} /> Submit for Review</button>
          )}
          {loan.status === 'submitted' && ['branch_manager','admin','super_admin'].includes(user?.role || '') && (
            <>
              <button onClick={() => approve.mutate()} disabled={approve.isPending} className="btn-success"><CheckCircle2 size={15} /> Approve</button>
              <button onClick={() => { const r = window.prompt('Rejection reason:'); if (r) fetch(`/api/v1/loans/${loanId}/reject`, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ reason: r }) }); }} className="btn-danger"><XCircle size={15} /> Reject</button>
            </>
          )}
          {loan.status === 'approved' && ['admin','super_admin'].includes(user?.role || '') && (
            <button onClick={() => { if (window.confirm('Confirm loan disbursement?')) disburse.mutate(); }} disabled={disburse.isPending} className="btn-success"><DollarSign size={15} /> Disburse Loan</button>
          )}
          {['active','in_arrears'].includes(loan.status) && (
            <a href={`/loans/${loanId}/repayment`} className="btn-primary"><DollarSign size={15} /> Record Repayment</a>
          )}
        </div>
      </div>

      {/* Loan summary cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Principal', value: fmtGHS(loan.principalAmount), color: 'text-slate-900' },
          { label: 'Outstanding', value: fmtGHS(loan.outstandingPrincipal), color: 'text-blue-700' },
          { label: 'Accrued Interest', value: fmtGHS(loan.accruedInterest), color: 'text-amber-600' },
          { label: 'Accrued Penalty', value: fmtGHS(loan.accruedPenalty), color: loan.accruedPenalty > 0 ? 'text-red-600' : 'text-slate-400' },
        ].map(item => (
          <div key={item.label} className="card p-4">
            <p className="text-xs text-slate-500 mb-1">{item.label}</p>
            <p className={`text-lg font-bold money ${item.color}`}>{item.value}</p>
          </div>
        ))}
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Loan Details</h3></div>
          <div className="card-body">
            <dl className="space-y-3 text-sm">
              {[
                ['Loan Number', loan.loanNumber, true],
                ['Product Code', loan.productCode],
                ['Interest Rate', `${(parseFloat(loan.interestRatePa) * 100).toFixed(2)}% p.a.`],
                ['Interest Method', loan.interestMethod?.replace(/_/g, ' ')],
                ['Tenor', `${loan.tenorMonths} months`],
                ['Repayment Freq.', loan.repaymentFrequency],
                ['Grace Period', `${loan.gracePeriodDays} days`],
                ['Disbursement Date', loan.disbursementDate ? new Date(loan.disbursementDate).toLocaleDateString('en-GH') : '—'],
                ['Maturity Date', loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-GH') : '—'],
                ['Risk Grade', loan.riskGrade || '—'],
                ['Credit Score', loan.creditScore || '—'],
                ['Days in Arrears', loan.daysInArrears],
                ['Times Restructured', loan.timesRestructured],
              ].map(([label, value, mono]: any) => (
                <div key={label} className="flex justify-between">
                  <dt className="text-slate-500">{label}</dt>
                  <dd className={`font-medium text-slate-800 ${mono ? 'font-mono' : ''}`}>{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Repayment Schedule */}
        {schedule && (
          <div className="card">
            <div className="card-header">
              <h3 className="font-semibold">Repayment Schedule</h3>
              <span className="badge-blue text-xs">{schedule.filter((s: any) => s.status === 'paid').length}/{schedule.length} paid</span>
            </div>
            <div className="overflow-y-auto max-h-80">
              <table className="data-table text-xs">
                <thead><tr>
                  <th>#</th><th>Due Date</th><th>Principal</th><th>Interest</th>
                  <th>Penalty</th><th>Total</th><th>Status</th>
                </tr></thead>
                <tbody>
                  {schedule.map((s: any) => (
                    <tr key={s.scheduleId} className={s.status === 'overdue' ? 'bg-red-50' : s.status === 'paid' ? 'bg-emerald-50' : ''}>
                      <td className="font-mono">{s.installmentNo}</td>
                      <td>{new Date(s.dueDate).toLocaleDateString('en-GH')}</td>
                      <td className="money">{(Number(s.principalDue) / 100).toFixed(2)}</td>
                      <td className="money">{(Number(s.interestDue) / 100).toFixed(2)}</td>
                      <td className={`money ${s.penaltyDue > 0 ? 'text-red-600' : 'text-slate-300'}`}>{(Number(s.penaltyDue) / 100).toFixed(2)}</td>
                      <td className="money font-semibold">{(Number(s.totalDue) / 100).toFixed(2)}</td>
                      <td>
                        <span className={`badge ${s.status === 'paid' ? 'badge-green' : s.status === 'overdue' ? 'badge-red' : s.status === 'partial' ? 'badge-yellow' : 'badge-gray'}`}>{s.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// src/pages/audit/AuditLogsPage.tsx
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, Download, Search } from 'lucide-react';

export function AuditLogsPage() {
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken;
  const [filters, setFilters] = useState({ actionType: '', entityType: '', fromDate: '', toDate: '', page: 1 });

  const { data, isLoading } = useQuery({
    queryKey: ['audit', filters],
    queryFn: () => fetch(`/api/v1/audit?${new URLSearchParams(Object.entries(filters).map(([k, v]) => [k, String(v)]))}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(r => r.data),
  });

  const ACTION_TYPES = [
    'USER_LOGIN','USER_LOGOUT','ACCOUNT_CREATED','ACCOUNT_FROZEN','CUSTOMER_CREATED',
    'LOAN_APPROVED','LOAN_DISBURSED','LOAN_REPAYMENT_POSTED','LOAN_WRITTEN_OFF',
    'FD_PLACED','FD_EARLY_BROKEN','PASSWORD_CHANGED','PASSWORD_RESET',
    'KYC_STATUS_UPDATED','CUSTOMER_FROZEN','DRAWER_OPENED','DRAWER_CLOSED',
  ];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Audit Logs</h1>
          <p className="page-subtitle">Immutable record of all system actions and events</p>
        </div>
        <button onClick={() => {
          const params = new URLSearchParams({ ...filters, format: 'csv', limit: '10000' });
          window.location.href = `/api/v1/audit/export?${params}`;
        }} className="btn-secondary">
          <Download size={15} /> Export
        </button>
      </div>

      {/* Filters */}
      <div className="card p-4">
        <div className="grid grid-cols-4 gap-3">
          <select className="input" value={filters.actionType} onChange={e => setFilters(f => ({ ...f, actionType: e.target.value, page: 1 }))}>
            <option value="">All Actions</option>
            {ACTION_TYPES.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
          </select>
          <select className="input" value={filters.entityType} onChange={e => setFilters(f => ({ ...f, entityType: e.target.value, page: 1 }))}>
            <option value="">All Entities</option>
            {['user','customer','account','loan','fixed_deposit','transaction','drawer'].map(e => (
              <option key={e} value={e}>{e.replace(/_/g, ' ')}</option>
            ))}
          </select>
          <input type="date" className="input" value={filters.fromDate} onChange={e => setFilters(f => ({ ...f, fromDate: e.target.value }))} placeholder="From date" />
          <input type="date" className="input" value={filters.toDate} onChange={e => setFilters(f => ({ ...f, toDate: e.target.value }))} placeholder="To date" />
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr>
            <th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th>
            <th>Entity</th><th>Entity ID</th><th>Description</th><th>IP Address</th>
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : (data?.data || []).map((log: any) => (
              <tr key={log.auditId}>
                <td className="text-xs font-mono text-slate-500">{new Date(log.createdAt).toLocaleString('en-GH')}</td>
                <td className="text-xs font-medium">{log.actorUserId?.slice(0, 8)}...</td>
                <td><span className="badge-gray text-xs">{log.actorRole}</span></td>
                <td><span className="text-xs font-semibold text-blue-700">{log.actionType}</span></td>
                <td className="text-xs capitalize">{log.entityType?.replace(/_/g, ' ')}</td>
                <td className="font-mono text-xs text-slate-400">{log.entityId?.slice(0, 12)}...</td>
                <td className="text-xs text-slate-500 max-w-xs truncate">{log.description || '—'}</td>
                <td className="font-mono text-xs text-slate-400">{log.ipAddress || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {data?.meta && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Showing {((filters.page - 1) * 50) + 1}–{Math.min(filters.page * 50, data.meta.total)} of {data.meta.total.toLocaleString()} records</span>
          <div className="flex gap-2">
            <button onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))} disabled={filters.page === 1} className="btn-secondary btn-sm">Previous</button>
            <button onClick={() => setFilters(f => ({ ...f, page: f.page + 1 }))} disabled={filters.page * 50 >= data.meta.total} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// src/pages/ledger/TrialBalancePage.tsx
// ============================================================
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BookOpen, Download, CheckCircle, AlertCircle } from 'lucide-react';

export function TrialBalancePage() {
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}')?.state?.accessToken;
  const [toDate, setToDate] = useState(new Date().toISOString().split('T')[0]);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['trial-balance', toDate],
    queryFn: () => fetch(`/api/v1/reports/trial-balance?fromDate=2026-01-01&toDate=${toDate}`, {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(r => r.data),
  });

  const fmtGHS = (v: any) => (Number(v) / 100).toLocaleString('en-GH', { minimumFractionDigits: 2 });
  const classes = ['asset', 'liability', 'equity', 'income', 'expense'];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div>
          <h1 className="page-title">Trial Balance</h1>
          <p className="page-subtitle">General ledger balances as at selected date</p>
        </div>
        <div className="flex items-center gap-3">
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="input" />
          <button onClick={() => window.print()} className="btn-secondary"><Download size={15} /> Print</button>
        </div>
      </div>

      {data && (
        <div className={`card p-4 flex items-center gap-3 ${data.balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          {data.balanced
            ? <><CheckCircle size={20} className="text-emerald-600" /><span className="font-medium text-emerald-700">Trial Balance is BALANCED — Debits = Credits = GHS {fmtGHS(data.totalDebits)}</span></>
            : <><AlertCircle size={20} className="text-red-600" /><span className="font-medium text-red-700">⚠️ UNBALANCED — Debits: {fmtGHS(data.totalDebits)} | Credits: {fmtGHS(data.totalCredits)}</span></>
          }
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead><tr>
            <th>Account Code</th><th>Account Name</th><th>Class</th>
            <th className="text-right">Total Debits (GHS)</th><th className="text-right">Total Credits (GHS)</th>
          </tr></thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto" /></td></tr>
            ) : classes.map(cls => {
              const rows = (data?.rows || []).filter((r: any) => r.account_class === cls);
              if (!rows.length) return null;
              const totalD = rows.reduce((s: number, r: any) => s + Number(r.total_debits), 0);
              const totalC = rows.reduce((s: number, r: any) => s + Number(r.total_credits), 0);
              return [
                <tr key={`hdr-${cls}`} className="bg-slate-100">
                  <td colSpan={3} className="font-bold text-slate-700 py-2 uppercase text-xs tracking-wider">{cls}</td>
                  <td className="text-right font-bold money">{fmtGHS(totalD)}</td>
                  <td className="text-right font-bold money">{fmtGHS(totalC)}</td>
                </tr>,
                ...rows.map((r: any) => (
                  <tr key={r.account_code}>
                    <td className="font-mono text-blue-700 font-medium">{r.account_code}</td>
                    <td>{r.account_name}</td>
                    <td><span className="badge-gray text-xs">{r.account_class}</span></td>
                    <td className="text-right money">{Number(r.total_debits) > 0 ? fmtGHS(r.total_debits) : '—'}</td>
                    <td className="text-right money">{Number(r.total_credits) > 0 ? fmtGHS(r.total_credits) : '—'}</td>
                  </tr>
                )),
              ];
            })}
          </tbody>
          {data && (
            <tfoot>
              <tr className="bg-slate-900 text-white">
                <td colSpan={3} className="px-4 py-3 font-bold">GRAND TOTAL</td>
                <td className="px-4 py-3 text-right font-bold money">GHS {fmtGHS(data.totalDebits)}</td>
                <td className="px-4 py-3 text-right font-bold money">GHS {fmtGHS(data.totalCredits)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

// ============================================================
// src/utils/cn.ts
// ============================================================
export function cn(...classes: (string | undefined | false | null)[]) {
  return classes.filter(Boolean).join(' ');
}
