// ============================================================
// src/store/auth.store.ts
// ============================================================
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface User {
  userId: string;
  username: string;
  fullName: string;
  email: string;
  role: string;
  branchId: string;
  mfaEnabled: boolean;
  mustChangePassword: boolean;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  partialToken: string | null; // MFA step
  setAuth: (user: User, accessToken: string, refreshToken: string) => void;
  setPartialToken: (token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      partialToken: null,
      setAuth: (user, accessToken, refreshToken) =>
        set({ user, accessToken, refreshToken, isAuthenticated: true, partialToken: null }),
      setPartialToken: (token) => set({ partialToken: token }),
      logout: () => set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, partialToken: null }),
      updateUser: (updates) => set((state) => ({ user: state.user ? { ...state.user, ...updates } : null })),
    }),
    {
      name: 'gtsl-auth',
      storage: createJSONStorage(() => sessionStorage),
      partialize: (state) => ({ user: state.user, accessToken: state.accessToken, refreshToken: state.refreshToken, isAuthenticated: state.isAuthenticated }),
    }
  )
);

// ============================================================
// src/api/client.ts  — Axios instance with auth interceptors
// ============================================================
import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';

const BASE_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// Request interceptor — inject auth token
apiClient.interceptors.request.use(
  (config) => {
    const authState = JSON.parse(sessionStorage.getItem('gtsl-auth') || '{}');
    const token = authState?.state?.accessToken;
    if (token) config.headers.Authorization = `Bearer ${token}`;
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor — handle errors globally
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const message = error.response?.data?.message || 'An error occurred';

    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
      return Promise.reject(error);
    }

    if (error.response?.status === 403) {
      toast.error('Access denied: ' + message);
    } else if (error.response?.status >= 500) {
      toast.error('Server error. Please try again.');
    }

    return Promise.reject(error);
  }
);

export function setIdempotencyKey(key: string) {
  return { headers: { 'X-Idempotency-Key': key } };
}

// ============================================================
// src/api/auth.api.ts
// ============================================================
export const authApi = {
  login: (data: { username: string; password: string; mfaToken?: string }) =>
    apiClient.post('/auth/login', data).then(r => r.data),

  logout: () => apiClient.post('/auth/logout').then(r => r.data),

  getProfile: () => apiClient.get('/auth/me').then(r => r.data),

  setupMfa: () => apiClient.get('/auth/mfa/setup').then(r => r.data),

  enableMfa: (token: string) =>
    apiClient.post('/auth/mfa/enable', { token }).then(r => r.data),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    apiClient.patch('/auth/change-password', data).then(r => r.data),
};

// ============================================================
// src/api/customers.api.ts
// ============================================================
export const customersApi = {
  search: (params: Record<string, any>) =>
    apiClient.get('/customers', { params }).then(r => r.data),

  getOne: (customerId: string) =>
    apiClient.get(`/customers/${customerId}`).then(r => r.data),

  create: (data: any) =>
    apiClient.post('/customers', data).then(r => r.data),

  update: (customerId: string, data: any) =>
    apiClient.patch(`/customers/${customerId}`, data).then(r => r.data),

  kycReview: (customerId: string, data: any) =>
    apiClient.post(`/customers/${customerId}/kyc-review`, data).then(r => r.data),

  freeze: (customerId: string, reason: string) =>
    apiClient.post(`/customers/${customerId}/freeze`, { reason }).then(r => r.data),

  getAccounts: (customerId: string) =>
    apiClient.get(`/customers/${customerId}/accounts`).then(r => r.data),
};

// ============================================================
// src/api/accounts.api.ts
// ============================================================
export const accountsApi = {
  create: (data: any) => apiClient.post('/accounts', data).then(r => r.data),

  getOne: (accountId: string) => apiClient.get(`/accounts/${accountId}`).then(r => r.data),

  getByNumber: (accountNumber: string) =>
    apiClient.get(`/accounts/by-number/${accountNumber}`).then(r => r.data),

  getBalance: (accountId: string) =>
    apiClient.get(`/accounts/${accountId}/balance`).then(r => r.data),

  getStatement: (accountId: string, params: { fromDate: string; toDate: string; page?: number; limit?: number }) =>
    apiClient.get(`/accounts/${accountId}/statement`, { params }).then(r => r.data),

  activate: (accountId: string) =>
    apiClient.post(`/accounts/${accountId}/activate`).then(r => r.data),

  freeze: (accountId: string, reason: string) =>
    apiClient.post(`/accounts/${accountId}/freeze`, { reason }).then(r => r.data),

  unfreeze: (accountId: string) =>
    apiClient.post(`/accounts/${accountId}/unfreeze`).then(r => r.data),

  close: (accountId: string, reason: string) =>
    apiClient.post(`/accounts/${accountId}/close`, { reason }).then(r => r.data),
};

// ============================================================
// src/api/transactions.api.ts
// ============================================================
export const transactionsApi = {
  deposit: (data: any, idempotencyKey?: string) =>
    apiClient.post('/transactions/deposit', data, idempotencyKey ? setIdempotencyKey(idempotencyKey) : {}).then(r => r.data),

  withdrawal: (data: any, idempotencyKey?: string) =>
    apiClient.post('/transactions/withdrawal', data, idempotencyKey ? setIdempotencyKey(idempotencyKey) : {}).then(r => r.data),

  transfer: (data: any) =>
    apiClient.post('/transactions/transfer', data).then(r => r.data),

  reverse: (transactionId: string, reason: string) =>
    apiClient.post(`/transactions/${transactionId}/reverse`, { reason }).then(r => r.data),

  getOne: (transactionId: string) =>
    apiClient.get(`/transactions/${transactionId}`).then(r => r.data),

  getByRef: (ref: string) =>
    apiClient.get(`/transactions/by-ref/${ref}`).then(r => r.data),
};

// ============================================================
// src/api/teller.api.ts
// ============================================================
export const tellerApi = {
  openDrawer: (openingBalance: number) =>
    apiClient.post('/teller/drawer/open', { openingBalance }).then(r => r.data),

  closeDrawer: (physicalCount: number) =>
    apiClient.post('/teller/drawer/close', { physicalCount }).then(r => r.data),

  getDrawerSummary: () =>
    apiClient.get('/teller/drawer/summary').then(r => r.data),
};

// ============================================================
// src/api/loans.api.ts
// ============================================================
export const loansApi = {
  create: (data: any) => apiClient.post('/loans', data).then(r => r.data),
  search: (params: any) => apiClient.get('/loans', { params }).then(r => r.data),
  getOne: (loanId: string) => apiClient.get(`/loans/${loanId}`).then(r => r.data),
  getSchedule: (loanId: string) => apiClient.get(`/loans/${loanId}/schedule`).then(r => r.data),
  getPortfolio: (branchId?: string) => apiClient.get('/loans/portfolio', { params: { branchId } }).then(r => r.data),
  submit: (loanId: string) => apiClient.post(`/loans/${loanId}/submit`).then(r => r.data),
  creditAnalysis: (loanId: string, data: any) => apiClient.post(`/loans/${loanId}/credit-analysis`, data).then(r => r.data),
  approve: (loanId: string, data: any) => apiClient.post(`/loans/${loanId}/approve`, data).then(r => r.data),
  reject: (loanId: string, reason: string) => apiClient.post(`/loans/${loanId}/reject`, { reason }).then(r => r.data),
  disburse: (loanId: string) => apiClient.post(`/loans/${loanId}/disburse`).then(r => r.data),
  repayment: (loanId: string, data: any) => apiClient.post(`/loans/${loanId}/repayment`, data).then(r => r.data),
  restructure: (loanId: string, data: any) => apiClient.post(`/loans/${loanId}/restructure`, data).then(r => r.data),
  writeOff: (loanId: string, reason: string) => apiClient.post(`/loans/${loanId}/write-off`, { reason }).then(r => r.data),
};

// ============================================================
// src/api/fixed-deposits.api.ts
// ============================================================
export const fdApi = {
  place: (data: any) => apiClient.post('/fixed-deposits', data).then(r => r.data),
  getOne: (fdId: string) => apiClient.get(`/fixed-deposits/${fdId}`).then(r => r.data),
  getByCustomer: (customerId: string) => apiClient.get(`/fixed-deposits`, { params: { customerId } }).then(r => r.data),
  earlyLiquidation: (fdId: string, reason: string) => apiClient.post(`/fixed-deposits/${fdId}/liquidate`, { reason }).then(r => r.data),
};

// ============================================================
// src/api/ledger.api.ts
// ============================================================
export const ledgerApi = {
  getTrialBalance: (params: any) => apiClient.get('/reports/trial-balance', { params }).then(r => r.data),
  getAccountLedger: (accountCode: string, params: any) => apiClient.get(`/ledger/${accountCode}`, { params }).then(r => r.data),
  getJournal: (journalId: string) => apiClient.get(`/ledger/journals/${journalId}`).then(r => r.data),
};

// ============================================================
// src/api/workflow.api.ts
// ============================================================
export const workflowApi = {
  getPending: (params?: any) => apiClient.get('/workflow', { params }).then(r => r.data),
  getOne: (requestId: string) => apiClient.get(`/workflow/${requestId}`).then(r => r.data),
  approve: (requestId: string, notes?: string) => apiClient.post(`/workflow/${requestId}/approve`, { notes }).then(r => r.data),
  reject: (requestId: string, notes: string) => apiClient.post(`/workflow/${requestId}/reject`, { notes }).then(r => r.data),
  escalate: (requestId: string, notes: string) => apiClient.post(`/workflow/${requestId}/escalate`, { notes }).then(r => r.data),
};

// ============================================================
// src/api/reports.api.ts
// ============================================================
export const reportsApi = {
  getDashboard: (branchId?: string) =>
    apiClient.get('/reports/dashboard', { params: { branchId } }).then(r => r.data),

  generate: (type: string, params: any, format: string) =>
    apiClient.get(`/reports/generate/${type}`, {
      params: { ...params, format },
      responseType: 'blob',
    }).then(r => r.data),

  getLoanPortfolio: (branchId?: string) =>
    apiClient.get('/reports/loan-portfolio', { params: { branchId } }).then(r => r.data),

  getArrearsAging: (branchId?: string) =>
    apiClient.get('/reports/arrears-aging', { params: { branchId } }).then(r => r.data),

  getDisbursements: (params: any) =>
    apiClient.get('/reports/disbursements', { params }).then(r => r.data),

  getTellerCollections: (params: any) =>
    apiClient.get('/reports/teller-collections', { params }).then(r => r.data),
};

// ============================================================
// src/api/audit.api.ts
// ============================================================
export const auditApi = {
  search: (params: any) => apiClient.get('/audit', { params }).then(r => r.data),
};

// ============================================================
// src/api/admin.api.ts
// ============================================================
export const adminApi = {
  // Users
  getUsers: (params?: any) => apiClient.get('/users', { params }).then(r => r.data),
  createUser: (data: any) => apiClient.post('/users', data).then(r => r.data),
  updateUser: (userId: string, data: any) => apiClient.patch(`/users/${userId}`, data).then(r => r.data),
  unlockUser: (userId: string) => apiClient.post(`/users/${userId}/unlock`).then(r => r.data),
  resetPassword: (userId: string, newPassword: string) =>
    apiClient.post(`/users/${userId}/reset-password`, { newPassword }).then(r => r.data),

  // Products
  getProducts: () => apiClient.get('/configuration/products').then(r => r.data),
  updateProduct: (code: string, data: any) => apiClient.patch(`/configuration/products/${code}`, data).then(r => r.data),

  // Fees
  getFees: () => apiClient.get('/configuration/fees').then(r => r.data),
  updateFee: (id: string, data: any) => apiClient.patch(`/configuration/fees/${id}`, data).then(r => r.data),

  // Approval matrix
  getMatrix: () => apiClient.get('/configuration/approval-matrix').then(r => r.data),
  updateMatrix: (id: string, data: any) => apiClient.patch(`/configuration/approval-matrix/${id}`, data).then(r => r.data),

  // Branches
  getBranches: () => apiClient.get('/configuration/branches').then(r => r.data),
  createBranch: (data: any) => apiClient.post('/configuration/branches', data).then(r => r.data),
};

// ============================================================
// src/api/mobile-money.api.ts
// ============================================================
export const mobileMoneyApi = {
  initCollection: (data: any) =>
    apiClient.post('/integrations/mobile-money/collect', data).then(r => r.data),

  getStatus: (internalRef: string) =>
    apiClient.get(`/integrations/mobile-money/status/${internalRef}`).then(r => r.data),

  importSettlement: (formData: FormData) =>
    apiClient.post('/integrations/mobile-money/settlement/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then(r => r.data),
};
