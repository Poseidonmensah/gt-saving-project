import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@api/index';

const fmt = (v:any) => (Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2});

export function GLLedgerPage() {
  const { accountCode } = useParams<{accountCode:string}>();
  const [from,setFrom] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
  const [to,setTo]     = useState(new Date().toISOString().split('T')[0]);

  const { data,isLoading } = useQuery({
    queryKey: ['gl-ledger',accountCode,from,to],
    queryFn: () => ledgerApi.accountLedger(accountCode!, { fromDate: from, toDate: to }),
    enabled: !!accountCode,
  });
  const rows = (data as any)||[];

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title font-mono">Account Ledger — {accountCode}</h1><p className="page-subtitle">All postings for this GL account</p></div></div>
      <div className="card p-4"><div className="flex gap-3"><input type="date" value={from} onChange={e=>setFrom(e.target.value)} className="input"/><input type="date" value={to} onChange={e=>setTo(e.target.value)} className="input"/></div></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Date</th><th>Journal No.</th><th>Narration</th><th>Type</th><th className="text-right">Amount (GHS)</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : rows.length===0 ? <tr><td colSpan={5} className="text-center py-8 text-slate-400">No entries found for this period</td></tr>
            : rows.map((r:any,i:number)=>(
              <tr key={i}>
                <td className="text-xs text-slate-500">{new Date(r.posting_date).toLocaleDateString('en-GH')}</td>
                <td className="font-mono text-xs text-blue-700">{r.journal_no}</td>
                <td className="text-sm">{r.narration||r.journal_narration}</td>
                <td><span className={`badge text-xs ${r.entry_type==='debit'?'badge-blue':'badge-green'}`}>{r.entry_type}</span></td>
                <td className={`text-right money font-semibold ${r.entry_type==='debit'?'text-blue-700':'text-emerald-700'}`}>{fmt(r.amount)}</td>
              </tr>
            ))}
          </tbody>
          {rows.length>0 && <tfoot><tr className="bg-slate-50 font-semibold"><td colSpan={3} className="px-4 py-2">Totals</td><td className="px-4 py-2 text-blue-700">DR: {fmt(rows.filter((r:any)=>r.entry_type==='debit').reduce((s:number,r:any)=>s+Number(r.amount),0))}</td><td className="px-4 py-2 text-right text-emerald-700">CR: {fmt(rows.filter((r:any)=>r.entry_type==='credit').reduce((s:number,r:any)=>s+Number(r.amount),0))}</td></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
