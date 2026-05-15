import { useParams } from 'react-router-dom';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '@hooks/useApi';
import { Download, Printer } from 'lucide-react';

export function AccountStatementPage() {
  const { accountId } = useParams<{ accountId: string }>();
  const today = new Date().toISOString().split('T')[0];
  const monthAgo = new Date(Date.now() - 30*864e5).toISOString().split('T')[0];
  const [from, setFrom] = useState(monthAgo);
  const [to, setTo] = useState(today);
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['statement', accountId, from, to, page],
    queryFn: () => apiFetch(`/accounts/${accountId}/statement?fromDate=${from}&toDate=${to}&page=${page}&limit=50`),
    enabled: !!accountId,
  });
  const fmtGHS = (v: any) => (Number(v||0)/100).toFixed(2);

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Account Statement</h1><p className="page-subtitle">{data?.account?.accountNumber}</p></div>
        <div className="flex gap-2">
          <button onClick={() => window.print()} className="btn-secondary no-print"><Printer size={15}/> Print</button>
        </div>
      </div>
      <div className="card p-4 flex gap-4 items-end no-print">
        <div className="form-group mb-0"><label className="label">From</label><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="input"/></div>
        <div className="form-group mb-0"><label className="label">To</label><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="input"/></div>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Reference</th><th>Type</th><th>Narration</th><th className="text-right">Debit</th><th className="text-right">Credit</th><th>Channel</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : (data?.transactions||[]).length === 0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No transactions in selected period</td></tr>
            : (data?.transactions||[]).map((t: any) => (
              <tr key={t.transaction_id}>
                <td className="text-xs">{new Date(t.posted_at||t.created_at).toLocaleDateString('en-GH')}</td>
                <td className="font-mono text-xs text-blue-600">{t.transaction_ref}</td>
                <td><span className="badge-gray text-xs">{t.transaction_type?.replace(/_/g,' ')}</span></td>
                <td className="text-xs max-w-xs truncate">{t.narration||'—'}</td>
                <td className="text-right money text-red-600">{t.debit_amount ? fmtGHS(t.debit_amount) : '—'}</td>
                <td className="text-right money text-emerald-600">{t.credit_amount ? fmtGHS(t.credit_amount) : '—'}</td>
                <td className="text-xs text-slate-400">{t.channel}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data?.meta && (
        <div className="flex items-center justify-between text-sm text-slate-500 no-print">
          <span>{data.meta.total} transactions</span>
          <div className="flex gap-2">
            <button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary btn-sm">Prev</button>
            <button onClick={()=>setPage(p=>p+1)} disabled={page*50>=data.meta.total} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
