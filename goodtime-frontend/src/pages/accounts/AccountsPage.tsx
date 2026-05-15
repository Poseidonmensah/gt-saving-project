import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiFetch } from '@hooks/useApi';
import { Plus } from 'lucide-react';

export function AccountsPage() {
  const [search, setSearch] = useState({ accountNumber: '', customerId: '', status: '', page: 1 });
  const { data, isLoading } = useQuery({
    queryKey: ['accounts', search],
    queryFn: () => apiFetch(`/accounts?${new URLSearchParams(Object.entries(search).map(([k,v])=>[k,String(v)]))}`),
  });
  const fmtGHS = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;
  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Accounts</h1><p className="page-subtitle">Manage all customer accounts</p></div>
      </div>
      <div className="card p-4 grid grid-cols-3 gap-3">
        <input className="input font-mono" placeholder="Account number..." value={search.accountNumber} onChange={e => setSearch(s=>({...s,accountNumber:e.target.value,page:1}))}/>
        <select className="input" value={search.status} onChange={e => setSearch(s=>({...s,status:e.target.value,page:1}))}>
          <option value="">All Statuses</option>
          {['active','dormant','frozen','closed','pending'].map(s=><option key={s} value={s}>{s}</option>)}
        </select>
        <div className="text-sm text-slate-500 flex items-center">Total: <strong className="ml-1">{data?.meta?.total||0}</strong></div>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Account No.</th><th>Type</th><th>Product</th><th>Balance</th><th>Available</th><th>Status</th><th>Branch</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : (data?.data||[]).map((a: any) => (
              <tr key={a.accountId}>
                <td><span className="font-mono text-blue-700 font-semibold">{a.accountNumber}</span></td>
                <td><span className="badge-blue">{a.accountType}</span></td>
                <td className="text-xs text-slate-500">{a.productCode}</td>
                <td className="money">{fmtGHS(a.currentBalance)}</td>
                <td className="money">{fmtGHS(a.availableBalance)}</td>
                <td><span className={a.status==='active'?'badge-green':a.status==='frozen'?'badge-red':'badge-gray'}>{a.status}</span></td>
                <td className="text-xs text-slate-400">{a.branchId?.slice(0,8)}</td>
                <td><Link to={`/accounts/${a.accountId}`} className="text-blue-600 text-sm font-medium hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
