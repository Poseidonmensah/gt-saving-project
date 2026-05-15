import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { TrendingUp, TrendingDown, Users, CreditCard, Landmark, Clock, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

function fmtGHS(p: any) { return `GHS ${(Number(p||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`; }

export function DashboardPage() {
  const { user } = useAuthStore();
  const { data: dash, isLoading } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => apiFetch('/reports/dashboard'),
    refetchInterval: 60_000,
  });

  const stats = [
    { label: "Today's Deposits",    value: fmtGHS(dash?.today?.deposits?.total),    sub: `${dash?.today?.deposits?.count||0} txns`,     icon: <TrendingUp size={20}/>,  color:'bg-emerald-100 text-emerald-600' },
    { label: "Today's Withdrawals", value: fmtGHS(dash?.today?.withdrawals?.total), sub: `${dash?.today?.withdrawals?.count||0} txns`,  icon: <TrendingDown size={20}/>, color:'bg-red-100 text-red-500' },
    { label: 'Active Loans',        value: dash?.loans?.active||0,                  sub: `${dash?.loans?.inArrears||0} in arrears`,     icon: <Landmark size={20}/>,    color:'bg-blue-100 text-blue-600' },
    { label: 'Total Customers',     value: (dash?.customers?.total||0).toLocaleString(), sub: `+${dash?.customers?.newThisMonth||0} this month`, icon: <Users size={20}/>, color:'bg-purple-100 text-purple-600' },
    { label: 'Pending Approvals',   value: dash?.pendingApprovals||0,               sub: 'Awaiting action',                              icon: <Clock size={20}/>,       color:'bg-amber-100 text-amber-600' },
    { label: 'Total Outstanding',   value: fmtGHS(dash?.loans?.totalOutstanding),   sub: 'Loan portfolio',                               icon: <CreditCard size={20}/>,  color:'bg-indigo-100 text-indigo-600' },
  ];

  const quickActions = [
    { label: 'New Deposit',       href: '/teller/deposit',      roles: ['teller','branch_manager','admin','super_admin'], cls:'btn-success' },
    { label: 'New Withdrawal',    href: '/teller/withdrawal',   roles: ['teller','branch_manager','admin','super_admin'], cls:'btn-secondary' },
    { label: 'New Customer',      href: '/customers/new',       roles: ['teller','branch_manager','admin','super_admin','customer_care','loan_officer'], cls:'btn-primary' },
    { label: 'Loan Application',  href: '/loans/new',           roles: ['loan_officer','branch_manager','admin','super_admin'], cls:'btn-secondary' },
    { label: 'Place Fixed Deposit', href: '/fixed-deposits/new', roles: ['teller','branch_manager','admin','super_admin'], cls:'btn-secondary' },
    { label: 'View Approvals',    href: '/workflow',            roles: ['branch_manager','admin','super_admin','loan_officer'], cls:'btn-secondary' },
  ].filter(a => a.roles.includes(user?.role||''));

  if (isLoading) return <div className="flex items-center justify-center h-64"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Good Morning, {user?.fullName?.split(' ')[0]}!</h1>
          <p className="page-subtitle">{new Date().toLocaleDateString('en-GH',{weekday:'long',year:'numeric',month:'long',day:'numeric'})}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
        {stats.map(s => (
          <div key={s.label} className="stat-card">
            <div className={`stat-icon ${s.color}`}>{s.icon}</div>
            <div><p className="text-xs text-slate-500 mb-1">{s.label}</p><p className="text-xl font-bold text-slate-900">{s.value}</p><p className="text-xs text-slate-400 mt-0.5">{s.sub}</p></div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Quick Actions</h3></div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-3">
              {quickActions.slice(0,6).map(a => (
                <Link key={a.label} to={a.href} className={`${a.cls} text-center text-xs py-2.5`}>{a.label}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Loan Portfolio Quality</h3></div>
          <div className="card-body space-y-3">
            {[
              { label:'Performing',  val: dash?.loans?.active||0,    color:'bg-emerald-500', pct:75 },
              { label:'In Arrears',  val: dash?.loans?.inArrears||0, color:'bg-amber-500',   pct:20 },
              { label:'Default',     val: 0,                          color:'bg-red-500',     pct:5  },
            ].map(r => (
              <div key={r.label}>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-600">{r.label}</span><span className="font-medium">{r.val}</span></div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden"><div className={`h-full rounded-full ${r.color}`} style={{width:`${r.pct}%`}}/></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
