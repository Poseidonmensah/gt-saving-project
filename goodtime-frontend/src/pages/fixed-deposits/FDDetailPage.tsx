import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fdApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

const fmt=(v:any)=>`GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;
const statusBadge=(s:string)=>{const m:Record<string,string>={active:'badge-green',matured:'badge-blue',closed:'badge-gray',broken:'badge-red'};return <span className={m[s]||'badge-gray'}>{s}</span>;};

export function FDDetailPage() {
  const { fdId } = useParams<{fdId:string}>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data: fd, isLoading } = useQuery({ queryKey:['fd',fdId], queryFn:()=>fdApi.getOne(fdId!) });
  const f = fd as any;
  const isManager = ['branch_manager','admin','super_admin'].includes(user?.role||'');
  const liquidate = useMutation({ mutationFn:()=>{const r=prompt('Reason for early liquidation:');if(!r)throw new Error('Cancelled');return fdApi.liquidate(fdId!,r);}, onSuccess:()=>{toast.success('Early liquidation request submitted');qc.invalidateQueries({queryKey:['fd',fdId]});}, onError:(e:any)=>toast.error(e.message) });

  if(isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if(!f) return <div className="text-center py-20 text-slate-400">Fixed deposit not found</div>;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="page-header">
        <div><h1 className="page-title font-mono">{f.fdNumber}</h1><p className="page-subtitle">{statusBadge(f.status)}</p></div>
        {f.status==='active' && isManager && <button onClick={()=>liquidate.mutate()} disabled={liquidate.isPending} className="btn-danger">Early Liquidation</button>}
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[['Principal',fmt(f.principalAmount),'text-slate-900'],['Accrued Interest',fmt(f.accruedInterest),'text-amber-600'],['Maturity Value',fmt(f.maturityValue),'text-emerald-600']].map(([l,v,c])=>(
          <div key={l as string} className="card p-4"><p className="text-xs text-slate-500 mb-1">{l}</p><p className={`text-lg font-bold money ${c}`}>{v}</p></div>
        ))}
      </div>
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Fixed Deposit Details</h3></div>
        <div className="card-body">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['FD Number',f.fdNumber],['Rate p.a.',(parseFloat(f.interestRatePa||'0')*100).toFixed(2)+'%'],['Tenor',`${f.tenorDays} days`],['Placement Date',new Date(f.placementDate).toLocaleDateString('en-GH')],['Maturity Date',new Date(f.maturityDate).toLocaleDateString('en-GH')],['Maturity Instruction',f.maturityInstruction?.replace(/_/g,' ')],['Auto-Rollover',f.autoRollover?'Yes':'No'],['Rollover Count',f.rolloverCount],['Notice Sent',f.noticeSent?'Yes':'No'],['Breakage Penalty',f.breakagePenalty?fmt(f.breakagePenalty):'—']].map(([l,v])=>(
              <div key={l}><dt className="text-slate-500">{l}</dt><dd className="font-medium">{v||'—'}</dd></div>
            ))}
          </dl>
        </div>
      </div>
    </div>
  );
}
