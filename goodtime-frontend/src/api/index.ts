import axios from 'axios';
import { useAuthStore } from '@store/auth.store';

export const api = axios.create({ baseURL: '/api/v1', timeout: 30000 });

api.interceptors.request.use(cfg => {
  const token = JSON.parse(sessionStorage.getItem('gtsl-auth')||'{}')?.state?.accessToken;
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

api.interceptors.response.use(r => r, err => {
  if (err.response?.status === 401) { useAuthStore.getState().logout(); window.location.href = '/login'; }
  return Promise.reject(err);
});

const d = (r: any) => r.data?.data ?? r.data;

// Auth
export const authApi = {
  login:          (b: any)    => api.post('/auth/login', b).then(d),
  logout:         ()          => api.post('/auth/logout').then(d),
  me:             ()          => api.get('/auth/me').then(d),
  setupMfa:       ()          => api.get('/auth/mfa/setup').then(d),
  enableMfa:      (token: string) => api.post('/auth/mfa/enable', { token }).then(d),
  changePassword: (b: any)    => api.patch('/auth/change-password', b).then(d),
};

// Customers
export const customersApi = {
  search:     (p: any)  => api.get('/customers', { params: p }).then(d),
  getOne:     (id: string) => api.get(`/customers/${id}`).then(d),
  create:     (b: any)  => api.post('/customers', b).then(d),
  update:     (id: string, b: any) => api.patch(`/customers/${id}`, b).then(d),
  kycReview:  (id: string, b: any) => api.post(`/customers/${id}/kyc-review`, b).then(d),
  freeze:     (id: string, reason: string) => api.post(`/customers/${id}/freeze`, { reason }).then(d),
  getAccounts:(id: string) => api.get(`/customers/${id}/accounts`).then(d),
};

// Accounts
export const accountsApi = {
  create:     (b: any)  => api.post('/accounts', b).then(d),
  getOne:     (id: string) => api.get(`/accounts/${id}`).then(d),
  byNumber:   (n: string) => api.get(`/accounts/by-number/${n}`).then(d),
  balance:    (id: string) => api.get(`/accounts/${id}/balance`).then(d),
  statement:  (id: string, p: any) => api.get(`/accounts/${id}/statement`, { params: p }).then(d),
  activate:   (id: string) => api.post(`/accounts/${id}/activate`).then(d),
  freeze:     (id: string, reason: string) => api.post(`/accounts/${id}/freeze`, { reason }).then(d),
  unfreeze:   (id: string) => api.post(`/accounts/${id}/unfreeze`).then(d),
  close:      (id: string, reason: string) => api.post(`/accounts/${id}/close`, { reason }).then(d),
};

// Transactions / Teller
export const txnApi = {
  deposit:    (b: any, key?: string) => api.post('/transactions/deposit', b, key ? { headers: { 'X-Idempotency-Key': key } } : {}).then(d),
  withdrawal: (b: any, key?: string) => api.post('/transactions/withdrawal', b, key ? { headers: { 'X-Idempotency-Key': key } } : {}).then(d),
  transfer:   (b: any)  => api.post('/transactions/transfer', b).then(d),
  reverse:    (id: string, reason: string) => api.post(`/transactions/${id}/reverse`, { reason }).then(d),
  getOne:     (id: string) => api.get(`/transactions/${id}`).then(d),
  openDrawer: (openingBalance: number) => api.post('/teller/drawer/open', { openingBalance }).then(d),
  closeDrawer:(physicalCount: number) => api.post('/teller/drawer/close', { physicalCount }).then(d),
  drawerSummary: () => api.get('/teller/drawer/summary').then(d),
};

// Loans
export const loansApi = {
  search:    (p: any) => api.get('/loans', { params: p }).then(d),
  portfolio: (branchId?: string) => api.get('/loans/portfolio', { params: { branchId } }).then(d),
  getOne:    (id: string) => api.get(`/loans/${id}`).then(d),
  schedule:  (id: string) => api.get(`/loans/${id}/schedule`).then(d),
  create:    (b: any) => api.post('/loans', b).then(d),
  submit:    (id: string) => api.post(`/loans/${id}/submit`).then(d),
  approve:   (id: string, b: any) => api.post(`/loans/${id}/approve`, b).then(d),
  reject:    (id: string, reason: string) => api.post(`/loans/${id}/reject`, { reason }).then(d),
  disburse:  (id: string) => api.post(`/loans/${id}/disburse`).then(d),
  repayment: (id: string, b: any) => api.post(`/loans/${id}/repayment`, b).then(d),
  restructure:(id: string, b: any) => api.post(`/loans/${id}/restructure`, b).then(d),
  writeOff:  (id: string, reason: string) => api.post(`/loans/${id}/write-off`, { reason }).then(d),
  creditAnalysis: (id: string, b: any) => api.post(`/loans/${id}/credit-analysis`, b).then(d),
};

// Fixed Deposits
export const fdApi = {
  search:    (p: any) => api.get('/fixed-deposits', { params: p }).then(d),
  getOne:    (id: string) => api.get(`/fixed-deposits/${id}`).then(d),
  place:     (b: any) => api.post('/fixed-deposits', b).then(d),
  liquidate: (id: string, reason: string) => api.post(`/fixed-deposits/${id}/liquidate`, { reason }).then(d),
};

// Workflow
export const workflowApi = {
  getAll:    (p?: any) => api.get('/workflow', { params: p }).then(d),
  getPending:() => api.get('/workflow/pending').then(d),
  getOne:    (id: string) => api.get(`/workflow/${id}`).then(d),
  approve:   (id: string, notes?: string) => api.post(`/workflow/${id}/approve`, { notes }).then(d),
  reject:    (id: string, notes: string) => api.post(`/workflow/${id}/reject`, { notes }).then(d),
  escalate:  (id: string, notes: string) => api.post(`/workflow/${id}/escalate`, { notes }).then(d),
};

// Reports
export const reportsApi = {
  dashboard:     (branchId?: string) => api.get('/reports/dashboard', { params: { branchId } }).then(d),
  trialBalance:  (p: any) => api.get('/reports/trial-balance', { params: p }).then(d),
  loanPortfolio: (branchId?: string) => api.get('/reports/loan-portfolio', { params: { branchId } }).then(d),
  arrearsAging:  (branchId?: string) => api.get('/reports/arrears-aging', { params: { branchId } }).then(d),
  disbursements: (p: any) => api.get('/reports/disbursements', { params: p }).then(d),
  tellerCollections: (p: any) => api.get('/reports/teller-collections', { params: p }).then(d),
  generate:      (type: string, p: any, format: string) =>
    api.get(`/reports/generate/${type}`, { params: { ...p, format }, responseType: 'blob' }),
};

// Audit
export const auditApi = {
  search: (p: any) => api.get('/audit', { params: p }).then(d),
};

// Admin / Config
export const adminApi = {
  getUsers:      (p?: any) => api.get('/users', { params: p }).then(d),
  createUser:    (b: any)  => api.post('/users', b).then(d),
  updateUser:    (id: string, b: any) => api.patch(`/users/${id}`, b).then(d),
  unlockUser:    (id: string) => api.post(`/users/${id}/unlock`).then(d),
  resetPassword: (id: string, newPassword: string) => api.post(`/users/${id}/reset-password`, { newPassword }).then(d),
  getProducts:   () => api.get('/configuration/products').then(d),
  updateProduct: (code: string, b: any) => api.patch(`/configuration/products/${code}`, b).then(d),
  getFees:       () => api.get('/configuration/fees').then(d),
  getMatrix:     () => api.get('/configuration/approval-matrix').then(d),
  getBranches:   () => api.get('/configuration/branches').then(d),
  createBranch:  (b: any) => api.post('/configuration/branches', b).then(d),
};

// Reconciliation
  getLoanProducts: () => api.get("/configuration/loan-products").then((r: any) => r.data?.data ?? r.data),

export const reconApi = {
  getSessions:  (p: any) => api.get('/reconciliation', { params: p }).then(d),
  startSession: (b: any) => api.post('/reconciliation/session', b).then(d),
  reconcileCash:(id: string, physicalCount: string) => api.post(`/reconciliation/${id}/cash`, { physicalCount }).then(d),
  reconcileGL:  (id: string) => api.post(`/reconciliation/${id}/gl`).then(d),
  getExceptions:(id: string) => api.get(`/reconciliation/${id}/exceptions`).then(d),
  resolveException: (eid: string, notes: string) => api.post(`/reconciliation/exceptions/${eid}/resolve`, { notes }).then(d),
};

// Ledger
export const ledgerApi = {
  trialBalance:    (p: any) => api.get('/ledger/trial-balance', { params: p }).then(d),
  accountLedger:   (code: string, p: any) => api.get(`/ledger/account/${code}`, { params: p }).then(d),
  chartOfAccounts: () => api.get('/ledger/chart-of-accounts').then(d),
  journal:         (id: string) => api.get(`/ledger/journals/${id}`).then(d),
};

// Additional missing method
// Patch adminApi to add getLoanProducts  
// (used by LoanApplicationPage)
export const getLoanProductsApi = {
  getLoanProducts: () => api.get('/configuration/loan-products').then((r: any) => r.data?.data ?? r.data),
};
