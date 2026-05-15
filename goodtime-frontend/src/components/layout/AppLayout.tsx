// ============================================================
// src/components/layout/AppLayout.tsx
// ============================================================
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useAuthStore } from '@store/auth.store';

interface AppLayoutProps { isPortal?: boolean; }

export function AppLayout({ isPortal = false }: AppLayoutProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-slate-50">
      <Sidebar isPortal={isPortal} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

// ============================================================
// src/components/layout/AuthLayout.tsx
// ============================================================
import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg">
            <span className="text-2xl font-bold text-white">GT</span>
          </div>
          <h1 className="text-2xl font-bold text-white">Good Time S&L</h1>
          <p className="text-slate-400 text-sm mt-1">Savings & Loans Management System</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <Outlet />
        </div>
        <p className="text-center text-slate-500 text-xs mt-6">
          © {new Date().getFullYear()} Good Time Saving & Loans Ltd · Ghana
        </p>
      </div>
    </div>
  );
}

// ============================================================
// src/components/layout/Sidebar.tsx
// ============================================================
import { NavLink } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import {
  LayoutDashboard, Users, CreditCard, Landmark, PiggyBank, 
  BarChart3, FileText, Settings, ShieldCheck, LogOut,
  Banknote, Receipt, ArrowLeftRight, AlertCircle, BookOpen,
  Workflow, UserCog, Bell, Home,
} from 'lucide-react';
import { cn } from '@utils/cn';

interface NavItem {
  label: string;
  to: string;
  icon: React.ReactNode;
  roles?: string[];
  badge?: number;
}

interface SidebarProps { isPortal?: boolean; }

const STAFF_NAV: NavItem[] = [
  { label: 'Dashboard', to: '/dashboard', icon: <LayoutDashboard size={18} /> },
  { label: 'Customers', to: '/customers', icon: <Users size={18} /> },
  { label: 'Accounts', to: '/accounts', icon: <CreditCard size={18} /> },
  { label: 'Teller', to: '/teller', icon: <Banknote size={18} />, roles: ['super_admin','admin','branch_manager','teller'] },
  { label: 'Loans', to: '/loans', icon: <Landmark size={18} /> },
  { label: 'Fixed Deposits', to: '/fixed-deposits', icon: <PiggyBank size={18} /> },
  { label: 'General Ledger', to: '/ledger/trial-balance', icon: <BookOpen size={18} />, roles: ['super_admin','admin','accountant','auditor'] },
  { label: 'Reconciliation', to: '/reconciliation', icon: <ArrowLeftRight size={18} />, roles: ['super_admin','admin','accountant'] },
  { label: 'Reports', to: '/reports', icon: <BarChart3 size={18} />, roles: ['super_admin','admin','branch_manager','accountant','auditor','compliance_officer'] },
  { label: 'Approvals', to: '/workflow', icon: <Workflow size={18} /> },
  { label: 'Audit Logs', to: '/audit', icon: <ShieldCheck size={18} />, roles: ['super_admin','admin','auditor','compliance_officer'] },
  { label: 'Admin', to: '/admin/users', icon: <UserCog size={18} />, roles: ['super_admin','admin'] },
];

const PORTAL_NAV: NavItem[] = [
  { label: 'My Dashboard', to: '/portal', icon: <Home size={18} /> },
  { label: 'My Accounts', to: '/portal/accounts', icon: <CreditCard size={18} /> },
  { label: 'My Loans', to: '/portal/loans', icon: <Landmark size={18} /> },
];

export function Sidebar({ isPortal }: SidebarProps) {
  const { user, logout } = useAuthStore();
  const navItems = isPortal ? PORTAL_NAV : STAFF_NAV;

  const visibleItems = navItems.filter(item =>
    !item.roles || (user?.role && item.roles.includes(user.role))
  );

  return (
    <aside className="flex flex-col w-[260px] h-full bg-white border-r border-slate-200 shadow-sm flex-shrink-0">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-slate-100">
        <div className="w-9 h-9 rounded-lg bg-blue-700 flex items-center justify-center flex-shrink-0">
          <span className="text-sm font-bold text-white">GT</span>
        </div>
        <div>
          <p className="text-sm font-bold text-slate-900 leading-none">Good Time S&L</p>
          <p className="text-xs text-slate-400 mt-0.5">
            {isPortal ? 'Customer Portal' : 'Management System'}
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
          >
            {item.icon}
            <span className="flex-1">{item.label}</span>
            {item.badge && item.badge > 0 && (
              <span className="ml-auto bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {item.badge}
              </span>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="px-3 py-3 border-t border-slate-100">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-slate-50">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-semibold text-blue-700">
              {user?.fullName?.charAt(0) || 'U'}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-slate-800 truncate">{user?.fullName}</p>
            <p className="text-xs text-slate-400 capitalize truncate">{user?.role?.replace(/_/g, ' ')}</p>
          </div>
          <button onClick={logout} className="text-slate-400 hover:text-red-500 transition-colors p-1">
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </aside>
  );
}

// ============================================================
// src/components/layout/Header.tsx
// ============================================================
import { Bell, Search, RefreshCw } from 'lucide-react';
import { useAuthStore } from '@store/auth.store';
import { useLocation } from 'react-router-dom';

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/customers': 'Customer Management',
  '/accounts': 'Account Management',
  '/teller': 'Teller Operations',
  '/loans': 'Loan Management',
  '/fixed-deposits': 'Fixed Deposits',
  '/ledger': 'General Ledger',
  '/reconciliation': 'Reconciliation',
  '/reports': 'Reports & Analytics',
  '/workflow': 'Pending Approvals',
  '/audit': 'Audit Logs',
  '/admin': 'Administration',
};

export function Header() {
  const location = useLocation();
  const { user } = useAuthStore();
  const title = Object.entries(PAGE_TITLES).find(([key]) => location.pathname.startsWith(key))?.[1] || 'Good Time S&L';

  return (
    <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6 flex-shrink-0">
      <div>
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="flex items-center gap-2">
        <div className="text-xs text-slate-400">
          {new Date().toLocaleDateString('en-GH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
        <div className="w-px h-5 bg-slate-200 mx-1" />
        <button className="btn-ghost p-2 rounded-lg">
          <Bell size={17} className="text-slate-500" />
        </button>
        <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
          <span className="text-xs font-semibold text-blue-700">{user?.fullName?.charAt(0)}</span>
        </div>
      </div>
    </header>
  );
}
