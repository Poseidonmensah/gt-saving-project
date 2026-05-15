import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ledgerApi } from '@api/index';
import { CheckCircle, XCircle, Download } from 'lucide-react';

const fmt = (v: any) => (Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2});

export function TrialBalancePage() {
  const [toDate,setToDate] = useState(new Date().toISOString().split('T')[0]);
  const { data,isLoading } = useQuery({
    queryKey: ['trial-balance',toDate],
    queryFn: () => ledgerApi.trialBalance({ fromDate:'2020-01-01', toDate }),
  });
  const d = data as any;
  const classes = ['asset','liability','equity','income','expense'];

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Trial Balance</h1><p className="page-subtitle">General ledger balances as at selected date</p></div>
        <div className="flex gap-3">
          <input type="date" value={toDate} onChange={e=>setToDate(e.target.value)} className="input"/>
          <button onClick={()=>window.print()} className="btn-secondary"><Download size={15}/> Print</button>
        </div>
      </div>

      {d && (
        <div className={`card p-4 flex items-center gap-3 ${d.balanced?'bg-emerald-50 border-emerald-200':'bg-red-50 border-red-200'}`}>
          {d.balanced
            ? <><CheckCircle size={20} className="text-emerald-600"/><span className="font-medium text-emerald-700">BALANCED — Debits = Credits = GHS {fmt(d.totalDebits)}</span></>
            : <><XCircle size={20} className="text-red-600"/><span className="font-medium text-red-700">UNBALANCED — DR: {fmt(d.totalDebits)} | CR: {fmt(d.totalCredits)}</span></>
          }
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Account Code</th><th>Account Name</th><th>Class</th><th className="text-right">Total Debits (GHS)</th><th className="text-right">Total Credits (GHS)</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={5} className="text-center py-12"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : classes.flatMap(cls => {
              const rows = (d?.rows||[]).filter((r:any)=>r.account_class===cls);
              if (!rows.length) return [];
              const tD = rows.reduce((s:number,r:any)=>s+Number(r.total_debits),0);
              const tC = rows.reduce((s:number,r:any)=>s+Number(r.total_credits),0);
              return [
                <tr key={`h-${cls}`} className="bg-slate-100"><td colSpan={3} className="font-bold text-slate-700 py-2 uppercase text-xs tracking-wider">{cls}</td><td className="text-right font-bold money">{fmt(tD)}</td><td className="text-right font-bold money">{fmt(tC)}</td></tr>,
                ...rows.map((r:any) => (
                  <tr key={r.account_code}>
                    <td className="font-mono text-blue-700 font-medium">{r.account_code}</td>
                    <td>{r.account_name}</td>
                    <td><span className="badge-gray text-xs">{r.account_class}</span></td>
                    <td className="text-right money">{Number(r.total_debits)>0?fmt(r.total_debits):'—'}</td>
                    <td className="text-right money">{Number(r.total_credits)>0?fmt(r.total_credits):'—'}</td>
                  </tr>
                )),
              ];
            })}
          </tbody>
          {d && <tfoot><tr className="bg-slate-900 text-white"><td colSpan={3} className="px-4 py-3 font-bold">GRAND TOTAL</td><td className="px-4 py-3 text-right font-bold money">GHS {fmt(d.totalDebits)}</td><td className="px-4 py-3 text-right font-bold money">GHS {fmt(d.totalCredits)}</td></tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
