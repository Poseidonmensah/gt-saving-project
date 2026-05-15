import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { loansApi } from '@api/index';
import { Plus } from 'lucide-react';
import { useAuthStore } from '@store/auth.store';

const statusBadge = (s: string) => {
  const m: Record<string,string> = { active:'badge-green', approved:'badge-blue', submitted:'badge-blue', in_arrears:'badge-yellow', default:'badge-red', closed:'badge-gray', draft:'badge-gray', written_off:'badge-red' };
  return <span className={m[s]||'badge-gray'}>{s.replace(/_/g,' ')}</span>;
};

export function LoansListPage() {
  const { user } = useAuthStore();
  const [f, setF] = useState({ status: '', loanNumber: '', page: 1 });
  const { data, isLoading } = useQuery({ queryKey: ['loans', f], queryFn: () => loansApi.search(f) });
  const canCreate = ['loan_officer','branch_manager','admin','super_admin'].includes(user?.role||'');

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Loan Management</h1><p className="page-subtitle">Applications and active portfolio</p></div>
        {canCreate && <Link to="/loans/new" className="btn-primary"><Plus size={16}/> New Application</Link>}
      </div>
      <div className="card p-4">
        <div className="grid grid-cols-3 gap-3">
          <input className="input font-mono" placeholder="Loan number..." value={f.loanNumber} onChange={e => setF(p => ({...p, loanNumber: e.target.value, page:1}))}/>
          <select className="input" value={f.status} onChange={e => setF(p => ({...p, status: e.target.value, page:1}))}>
            <option value="">All Statuses</option>
            {['draft','submitted','under_review','approved','active','in_arrears','default','closed','written_off'].map(s => <option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
          </select>
          <p className="text-sm text-slate-500 self-center">Total: <strong>{(data as any)?.meta?.total||0}</strong></p>
        </div>
      </div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Loan No.</th><th>Customer</th><th>Product</th><th className="text-right">Principal (GHS)</th><th className="text-right">Outstanding</th><th>Status</th><th className="text-center">Days Arrears</th><th>Grade</th><th>Maturity</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={10} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)?.data||[]).map((l: any) => (
              <tr key={l.loanId}>
                <td><span className="font-mono text-blue-700 font-semibold text-xs">{l.loanNumber}</span></td>
                <td className="text-xs">{l.customerId?.slice(0,8)}…</td>
                <td><span className="badge-blue text-xs">{l.productCode}</span></td>
                <td className="text-right money">{(Number(l.principalAmount)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}</td>
                <td className="text-right money font-semibold">{(Number(l.outstandingPrincipal)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}</td>
                <td>{statusBadge(l.status)}</td>
                <td className="text-center">{l.daysInArrears > 0 ? <span className={`font-bold ${l.daysInArrears>=90?'text-red-600':l.daysInArrears>=30?'text-amber-600':'text-orange-500'}`}>{l.daysInArrears}</span> : <span className="text-emerald-500">—</span>}</td>
                <td className="text-center font-bold">{l.riskGrade||'—'}</td>
                <td className="text-xs text-slate-500">{l.maturityDate ? new Date(l.maturityDate).toLocaleDateString('en-GH') : '—'}</td>
                <td><Link to={`/loans/${l.loanId}`} className="text-blue-600 text-sm font-medium hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data as any)?.meta && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>Page {f.page} of {Math.ceil((data as any).meta.total/25)}</span>
          <div className="flex gap-2">
            <button onClick={() => setF(p => ({...p, page: Math.max(1,p.page-1)}))} disabled={f.page===1} className="btn-secondary btn-sm">Previous</button>
            <button onClick={() => setF(p => ({...p, page: p.page+1}))} disabled={f.page*25>=(data as any).meta.total} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
