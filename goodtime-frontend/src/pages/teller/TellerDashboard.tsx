import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '@hooks/useApi';
import { useAuthStore } from '@store/auth.store';
import { ArrowDownCircle, ArrowUpCircle, DollarSign, RefreshCw } from 'lucide-react';

export function TellerDashboard() {
  const { user } = useAuthStore();
  const { data: drawer, refetch } = useQuery({ queryKey: ['drawer-summary'], queryFn: () => apiFetch('/teller/drawer/summary'), refetchInterval: 30000 });
  const fmtGHS = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;
  const drawerOpen = drawer?.status === 'open';

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div><h1 className="page-title">Teller Operations</h1><p className="page-subtitle">Welcome, {user?.fullName?.split(' ')[0]}</p></div>
        <button onClick={() => refetch()} className="btn-ghost"><RefreshCw size={15}/></button>
      </div>

      {!drawer ? (
        <div className="card p-8 text-center">
          <DollarSign size={40} className="mx-auto text-slate-300 mb-3"/>
          <p className="font-semibold text-slate-700 mb-1">No open drawer</p>
          <p className="text-slate-500 text-sm mb-4">Open your cash drawer to begin transactions</p>
          <Link to="/teller/drawer" className="btn-primary">Open Drawer</Link>
        </div>
      ) : (
        <>
          <div className={`card p-4 border-2 ${drawerOpen?'border-emerald-300 bg-emerald-50':'border-slate-200'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">Drawer Status</p>
                <p className={`text-lg font-bold ${drawerOpen?'text-emerald-700':'text-slate-500'}`}>{drawerOpen?'OPEN':'CLOSED'}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">System Balance</p>
                <p className="text-2xl font-bold money text-slate-900">{fmtGHS(drawer?.closing_balance||drawer?.opening_balance)}</p>
              </div>
              <Link to="/teller/drawer" className="btn-secondary">Manage Drawer</Link>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="stat-card"><div className="stat-icon bg-emerald-100 text-emerald-600"><ArrowDownCircle size={20}/></div><div><p className="text-xs text-slate-500">Total Deposits</p><p className="text-lg font-bold money">{fmtGHS(drawer?.total_deposits)}</p><p className="text-xs text-slate-400">{drawer?.transaction_count||0} transactions</p></div></div>
            <div className="stat-card"><div className="stat-icon bg-red-100 text-red-500"><ArrowUpCircle size={20}/></div><div><p className="text-xs text-slate-500">Total Withdrawals</p><p className="text-lg font-bold money">{fmtGHS(drawer?.total_withdrawals)}</p></div></div>
            <div className="stat-card"><div className="stat-icon bg-blue-100 text-blue-600"><DollarSign size={20}/></div><div><p className="text-xs text-slate-500">Fees Collected</p><p className="text-lg font-bold money">{fmtGHS(drawer?.total_fees)}</p></div></div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Link to="/teller/deposit" className="card p-6 hover:border-emerald-300 hover:bg-emerald-50 transition-all cursor-pointer group">
              <ArrowDownCircle size={32} className="text-emerald-500 mb-3 group-hover:scale-110 transition-transform"/>
              <h3 className="font-bold text-slate-900">Cash Deposit</h3>
              <p className="text-sm text-slate-500 mt-1">Receive cash deposit into customer account</p>
            </Link>
            <Link to="/teller/withdrawal" className="card p-6 hover:border-red-300 hover:bg-red-50 transition-all cursor-pointer group">
              <ArrowUpCircle size={32} className="text-red-500 mb-3 group-hover:scale-110 transition-transform"/>
              <h3 className="font-bold text-slate-900">Cash Withdrawal</h3>
              <p className="text-sm text-slate-500 mt-1">Process cash withdrawal from customer account</p>
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
