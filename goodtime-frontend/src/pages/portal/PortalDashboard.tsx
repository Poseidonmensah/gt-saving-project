import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';
import { CreditCard, Landmark, TrendingUp } from 'lucide-react';

const fmt = (v:any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function PortalDashboard() {
  const { user } = useAuthStore();
  const { data: accounts } = useQuery({ queryKey:['portal-accounts'], queryFn:()=>apiFetch(`/customers/${user?.customerId}/accounts`) });
  const { data: loans }    = useQuery({ queryKey:['portal-loans'],    queryFn:()=>apiFetch(`/loans?customerId=${user?.customerId}`) });
  const accs = (accounts as any)||[];
  const lns  = (loans as any)?.data||(Array.isArray(loans)?loans:[]);
  const totalBalance = accs.reduce((s:number,a:any)=>s+Number(a.current_balance),0);

  return (
    <div className="space-y-6">
      <div><h1 className="page-title">Welcome, {user?.fullName?.split(' ')[0]}</h1><p className="page-subtitle">Your Good Time S&L account overview</p></div>

      <div className="grid grid-cols-3 gap-4">
        {[['Total Balance',fmt(totalBalance),'bg-blue-100 text-blue-600',<TrendingUp size={20}/>],['Accounts',accs.length,'bg-emerald-100 text-emerald-600',<CreditCard size={20}/>],['Active Loans',lns.filter((l:any)=>l.status==='active').length,'bg-purple-100 text-purple-600',<Landmark size={20}/>]].map(([l,v,c,i])=>(
          <div key={l as string} className="stat-card"><div className={`stat-icon ${c}`}>{i}</div><div><p className="text-xs text-slate-500">{l}</p><p className="text-2xl font-bold mt-1">{v}</p></div></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">My Accounts</h3><Link to="/portal/accounts" className="text-blue-600 text-sm">View all →</Link></div>
          <div className="card-body space-y-3">
            {accs.slice(0,3).map((a:any)=>(
              <div key={a.account_id} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div><p className="font-mono text-sm font-semibold">{a.account_number}</p><p className="text-xs text-slate-500 capitalize">{a.account_type}</p></div>
                <p className="money font-bold text-emerald-700">{fmt(a.current_balance)}</p>
              </div>
            ))}
            {accs.length===0 && <p className="text-slate-400 text-sm text-center py-4">No accounts found</p>}
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">My Loans</h3><Link to="/portal/loans" className="text-blue-600 text-sm">View all →</Link></div>
          <div className="card-body space-y-3">
            {lns.slice(0,3).map((l:any)=>(
              <div key={l.loanId} className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                <div><p className="font-mono text-sm font-semibold">{l.loanNumber}</p><p className="text-xs text-slate-500">{l.status}</p></div>
                <p className="money font-bold text-blue-700">{fmt(l.outstandingPrincipal)}</p>
              </div>
            ))}
            {lns.length===0 && <p className="text-slate-400 text-sm text-center py-4">No active loans</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
