import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';

const fmt = (v:any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function PortalLoansPage() {
  const { user } = useAuthStore();
  const { data, isLoading } = useQuery({ queryKey:['portal-loans-full'], queryFn:()=>apiFetch(`/loans?customerId=${user?.customerId}`) });
  const loans = (data as any)?.data||(Array.isArray(data)?data:[]);

  const statusBadge=(s:string)=>{const m:Record<string,string>={active:'badge-green',in_arrears:'badge-yellow',default:'badge-red',closed:'badge-gray'};return <span className={m[s]||'badge-gray'}>{s.replace(/_/g,' ')}</span>;};

  return (
    <div className="space-y-5">
      <div><h1 className="page-title">My Loans</h1></div>
      {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>
      : loans.length===0 ? <div className="card p-12 text-center text-slate-400">You have no loans on record</div>
      : <div className="space-y-4">
          {loans.map((l:any)=>(
            <div key={l.loanId} className="card p-5">
              <div className="flex justify-between items-start mb-3">
                <div><p className="font-mono font-bold text-blue-700">{l.loanNumber}</p><p className="text-sm text-slate-500">{l.productCode} · {statusBadge(l.status)}</p></div>
                <div className="text-right"><p className="text-xs text-slate-500">Outstanding</p><p className="text-xl font-bold text-blue-700">{fmt(l.outstandingPrincipal)}</p></div>
              </div>
              <div className="grid grid-cols-4 gap-3 text-sm">
                {[['Principal',fmt(l.principalAmount)],['Interest Rate',(parseFloat(l.interestRatePa||'0')*100).toFixed(1)+'% p.a.'],['Maturity',l.maturityDate?new Date(l.maturityDate).toLocaleDateString('en-GH'):'—'],['Days Arrears',l.daysInArrears||0]].map(([k,v])=>(
                  <div key={k}><p className="text-slate-500 text-xs">{k}</p><p className="font-semibold">{v}</p></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      }
    </div>
  );
}
