import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@api/index';
import { apiFetch } from '@hooks/useApi';

const fmt = (v:any) => (Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2});

export function JournalEntryPage() {
  const [from,setFrom] = useState(new Date().toISOString().split('T')[0]);
  const [to,setTo]     = useState(new Date().toISOString().split('T')[0]);
  const [selected,setSel] = useState<any>(null);

  const { data,isLoading } = useQuery({
    queryKey: ['journals',from,to],
    queryFn: () => apiFetch(`/ledger/gl-balances?periodDate=${to}`),
  });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Journal Entries</h1><p className="page-subtitle">Posted GL journals and ledger entries</p></div></div>
      <div className="card p-4"><div className="flex gap-3"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="input"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="input"/></div></div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Account Code</th><th>Account Name</th><th>Class</th><th className="text-right">Total Debits</th><th className="text-right">Total Credits</th><th className="text-right">Closing Balance</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={6} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)||[]).map((r:any)=>(
              <tr key={r.account_code}>
                <td className="font-mono text-blue-700 font-semibold">{r.account_code}</td>
                <td>{r.account_name}</td>
                <td><span className="badge-gray text-xs">{r.account_class}</span></td>
                <td className="text-right money">{fmt(r.total_debits)}</td>
                <td className="text-right money">{fmt(r.total_credits)}</td>
                <td className={`text-right money font-semibold ${Number(r.closing_balance)<0?'text-red-600':'text-slate-800'}`}>{fmt(Math.abs(r.closing_balance))}{Number(r.closing_balance)<0?' Cr':''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
