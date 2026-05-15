import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { fdApi } from '@api/index';
import { Plus } from 'lucide-react';

const statusBadge=(s:string)=>{const m:Record<string,string>={active:'badge-green',matured:'badge-blue',closed:'badge-gray',broken:'badge-red',rolled_over:'badge-yellow'};return <span className={m[s]||'badge-gray'}>{s.replace(/_/g,' ')}</span>;};
const fmt=(v:any)=>`GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function FixedDepositsPage() {
  const [page,setPage]=useState(1);
  const { data,isLoading } = useQuery({ queryKey:['fixed-deposits',page], queryFn:()=>fdApi.search({page,limit:25}) });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Fixed Deposits</h1><p className="page-subtitle">All placed fixed deposits</p></div><Link to="/fixed-deposits/new" className="btn-primary"><Plus size={16}/> Place FD</Link></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>FD No.</th><th>Customer</th><th className="text-right">Principal</th><th>Rate</th><th>Tenor</th><th>Placed</th><th>Maturity</th><th className="text-right">Maturity Value</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={10} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)?.data||[]).map((fd:any)=>(
              <tr key={fd.fdId}>
                <td className="font-mono text-blue-700 font-semibold text-xs">{fd.fdNumber}</td>
                <td className="text-xs">{fd.customerId?.slice(0,8)}…</td>
                <td className="text-right money">{fmt(fd.principalAmount)}</td>
                <td className="text-center">{(parseFloat(fd.interestRatePa||'0')*100).toFixed(1)}%</td>
                <td className="text-center">{fd.tenorDays} days</td>
                <td className="text-xs text-slate-500">{new Date(fd.placementDate).toLocaleDateString('en-GH')}</td>
                <td className="text-xs text-slate-500">{new Date(fd.maturityDate).toLocaleDateString('en-GH')}</td>
                <td className="text-right money font-semibold text-emerald-700">{fmt(fd.maturityValue)}</td>
                <td>{statusBadge(fd.status)}</td>
                <td><Link to={`/fixed-deposits/${fd.fdId}`} className="text-blue-600 text-sm font-medium hover:underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {(data as any)?.meta && <div className="flex justify-between text-sm text-slate-500"><span>Total: {(data as any).meta.total}</span><div className="flex gap-2"><button onClick={()=>setPage(p=>Math.max(1,p-1))} disabled={page===1} className="btn-secondary btn-sm">Prev</button><button onClick={()=>setPage(p=>p+1)} disabled={page*25>=(data as any).meta.total} className="btn-secondary btn-sm">Next</button></div></div>}
    </div>
  );
}
