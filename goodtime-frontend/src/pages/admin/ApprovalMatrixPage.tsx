import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@api/index';

const fmt = (v:any) => v!=null ? `GHS ${(Number(v)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}` : '∞';

export function ApprovalMatrixPage() {
  const { data, isLoading } = useQuery({ queryKey:['approval-matrix'], queryFn: adminApi.getMatrix });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Approval Matrix</h1><p className="page-subtitle">Configurable approval thresholds by workflow type and amount</p></div></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Workflow Type</th><th>Min Amount</th><th>Max Amount</th><th>Step 1 Role</th><th>Step 2 Role</th><th>Step 3 Role</th><th>SLA (hrs)</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)||[]).map((m:any,i:number)=>(
              <tr key={i}>
                <td className="font-semibold capitalize">{m.workflow_type?.replace(/_/g,' ')}</td>
                <td className="money">{fmt(m.min_amount)}</td>
                <td className="money">{fmt(m.max_amount)}</td>
                {[m.required_role_1, m.required_role_2, m.required_role_3].map((r:string,j:number)=>(
                  <td key={j}>{r?<span className="badge-blue text-xs">{r.replace(/_/g,' ')}</span>:'—'}</td>
                ))}
                <td className="text-center">{m.sla_hours}h</td>
                <td><span className={`badge text-xs ${m.is_active?'badge-green':'badge-gray'}`}>{m.is_active?'Active':'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
