import { useQuery } from '@tanstack/react-query';
import { loansApi, reportsApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { TrendingDown, AlertCircle, BarChart3 } from 'lucide-react';

const fmt = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function LoanPortfolioPage() {
  const { user } = useAuthStore();
  const { data: summary } = useQuery({ queryKey:['loan-portfolio-summary'], queryFn:()=>loansApi.portfolio(user?.role==='branch_manager'?user.branchId:undefined) });
  const { data: aging } = useQuery({ queryKey:['arrears-aging'], queryFn:()=>reportsApi.arrearsAging() });
  const s = summary as any;

  return (
    <div className="space-y-6">
      <div className="page-header"><div><h1 className="page-title">Loan Portfolio</h1><p className="page-subtitle">Portfolio quality overview and arrears aging</p></div></div>

      <div className="grid grid-cols-3 gap-4">
        {[['Active Loans',s?.active_count||0,'badge-green'],['In Arrears',s?.arrears_count||0,'badge-yellow'],['Defaulted',s?.default_count||0,'badge-red'],['Total Outstanding',fmt(s?.total_outstanding),''],['Arrears Outstanding',fmt(s?.arrears_outstanding),''],['Accrued Penalty',fmt(s?.total_accrued_penalty),'']].map(([l,v,b])=>(
          <div key={l as string} className="stat-card">
            <div className="flex-1"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold mt-1">{v}</p>{b && <span className={b as string+' mt-1 inline-block'}>{l}</span>}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><AlertCircle size={16} className="text-amber-500"/>Arrears Aging Report</h3></div>
        <div className="table-container">
          <table className="data-table">
            <thead><tr><th>Loan No.</th><th>Customer</th><th>Phone</th><th className="text-right">Outstanding</th><th className="text-right">Penalty</th><th className="text-center">Days</th><th>Bucket</th></tr></thead>
            <tbody>
              {((aging as any)||[]).length===0 ? <tr><td colSpan={7} className="text-center py-8 text-slate-400">No arrears — portfolio is clean</td></tr>
              : ((aging as any)||[]).map((r:any,i:number)=>(
                <tr key={i}>
                  <td className="font-mono text-blue-700 text-xs font-semibold">{r.loan_number}</td>
                  <td className="font-medium">{r.full_name}</td>
                  <td className="font-mono text-sm">{r.phone_number}</td>
                  <td className="text-right money font-semibold">{fmt(r.outstanding_principal)}</td>
                  <td className="text-right money text-red-600">{fmt(r.accrued_penalty)}</td>
                  <td className="text-center font-bold text-red-600">{r.days_in_arrears}</td>
                  <td><span className={`badge ${r.aging_bucket?.includes('90')?'badge-red':'badge-yellow'}`}>{r.aging_bucket}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
