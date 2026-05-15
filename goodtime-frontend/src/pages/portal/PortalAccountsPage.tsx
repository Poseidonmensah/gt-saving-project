import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';

const fmt = (v:any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function PortalAccountsPage() {
  const { user } = useAuthStore();
  const [selected, setSelected] = useState('');
  const [stmt, setStmt] = useState({ from: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0], to: new Date().toISOString().split('T')[0] });
  const { data: accounts } = useQuery({ queryKey:['portal-accts'], queryFn:()=>apiFetch(`/customers/${user?.customerId}/accounts`) });
  const { data: statement } = useQuery({ queryKey:['portal-stmt',selected,stmt], queryFn:()=>apiFetch(`/accounts/${selected}/statement?fromDate=${stmt.from}&toDate=${stmt.to}`), enabled:!!selected });
  const accs = (accounts as any)||[];
  const txns = (statement as any)?.data||(Array.isArray(statement)?statement:[]);

  return (
    <div className="space-y-5">
      <div><h1 className="page-title">My Accounts</h1></div>
      <div className="grid grid-cols-3 gap-4">
        {accs.map((a:any)=>(
          <button key={a.account_id} onClick={()=>setSelected(a.account_id)} className={`card p-4 text-left transition-all ${selected===a.account_id?'border-blue-500 ring-1 ring-blue-500':''}`}>
            <p className="font-mono text-sm font-semibold text-blue-700">{a.account_number}</p>
            <p className="text-xs text-slate-500 capitalize mt-0.5">{a.account_type}</p>
            <p className="text-xl font-bold text-emerald-700 mt-2">{fmt(a.current_balance)}</p>
            <span className={`badge text-xs mt-2 ${a.status==='active'?'badge-green':'badge-gray'}`}>{a.status}</span>
          </button>
        ))}
      </div>
      {selected && (
        <div className="card">
          <div className="card-header">
            <h3 className="font-semibold">Account Statement</h3>
            <div className="flex gap-2"><input type="date" value={stmt.from} onChange={e=>setStmt(s=>({...s,from:e.target.value}))} className="input text-xs py-1"/><input type="date" value={stmt.to} onChange={e=>setStmt(s=>({...s,to:e.target.value}))} className="input text-xs py-1"/></div>
          </div>
          <div className="table-container">
            <table className="data-table">
              <thead><tr><th>Date</th><th>Reference</th><th>Narration</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th className="text-right">Balance</th></tr></thead>
              <tbody>
                {txns.length===0 ? <tr><td colSpan={6} className="text-center py-8 text-slate-400">No transactions in this period</td></tr>
                : txns.map((t:any,i:number)=>(
                  <tr key={i}>
                    <td className="text-xs">{new Date(t.businessDate||t.created_at).toLocaleDateString('en-GH')}</td>
                    <td className="font-mono text-xs text-blue-700">{t.transactionRef||t.transaction_ref}</td>
                    <td className="text-sm">{t.narration}</td>
                    <td className="text-right money text-red-600">{t.transactionType?.includes('withdrawal')||t.transaction_type?.includes('withdrawal')?fmt(t.amount):'—'}</td>
                    <td className="text-right money text-emerald-600">{t.transactionType?.includes('deposit')||t.transaction_type?.includes('deposit')?fmt(t.amount):'—'}</td>
                    <td className="text-right money font-semibold">{fmt(t.runningBalance||0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
