import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { reconApi } from '@api/index';
import { CheckCircle, AlertCircle, Plus } from 'lucide-react';

export function ReconciliationPage() {
  const { data,isLoading } = useQuery({ queryKey:['recon-sessions'], queryFn:()=>reconApi.getSessions({}) });
  const sessions = (data as any)||[];
  const statusBadge = (s:string) => { const m:Record<string,string>={matched:'badge-green',exception:'badge-red',in_progress:'badge-yellow'}; return <span className={m[s]||'badge-gray'}>{s.replace(/_/g,' ')}</span>; };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Reconciliation</h1><p className="page-subtitle">Cash, bank and mobile money reconciliation</p></div>
        <div className="flex gap-2">
          <Link to="/reconciliation/cash" className="btn-primary"><Plus size={16}/> Cash Recon</Link>
          <Link to="/reconciliation/mobile-money" className="btn-secondary"><Plus size={16}/> Mobile Money Recon</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[['Cash Reconciliation','Reconcile teller drawer cash','/reconciliation/cash','bg-emerald-100 text-emerald-600'],['Mobile Money','Reconcile MTN MoMo & Vodafone','/reconciliation/mobile-money','bg-blue-100 text-blue-600'],['GL Balance Check','Verify debit = credit daily','#','bg-purple-100 text-purple-600']].map(([t,d,href,ico])=>(
          <Link key={t as string} to={href as string} className="card p-5 hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${ico}`}><CheckCircle size={20}/></div>
            <p className="font-semibold text-slate-900">{t}</p>
            <p className="text-sm text-slate-500 mt-1">{d}</p>
          </Link>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Recent Sessions</h3></div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Date</th><th>Type</th><th>Branch</th><th className="text-right">System Total</th><th className="text-right">External Total</th><th className="text-right">Variance</th><th>Status</th><th>Performed By</th></tr></thead>
            <tbody>
              {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
              : sessions.length===0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No reconciliation sessions found</td></tr>
              : sessions.map((s:any)=>(
                <tr key={s.sessionId}>
                  <td className="text-xs">{new Date(s.sessionDate).toLocaleDateString('en-GH')}</td>
                  <td><span className="badge-blue text-xs">{s.sessionType}</span></td>
                  <td className="text-xs">{s.branchId||'All'}</td>
                  <td className="text-right money">{(Number(s.systemTotal||0)/100).toFixed(2)}</td>
                  <td className="text-right money">{(Number(s.externalTotal||0)/100).toFixed(2)}</td>
                  <td className={`text-right money font-semibold ${s.variance!==0?'text-red-600':'text-emerald-600'}`}>{(Number(s.variance||0)/100).toFixed(2)}</td>
                  <td>{statusBadge(s.status)}</td>
                  <td className="text-xs text-slate-500">{s.performedBy?.slice(0,8)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
