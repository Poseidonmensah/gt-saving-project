import { useQuery } from '@tanstack/react-query';
import { adminApi } from '@api/index';

export function FeeConfigPage() {
  const { data, isLoading } = useQuery({ queryKey:['fees'], queryFn: adminApi.getFees });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Fee Configuration</h1><p className="page-subtitle">Transaction and service fee schedules</p></div></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Fee Code</th><th>Fee Name</th><th>Product</th><th>Type</th><th>Amount/Rate</th><th>Min</th><th>Max</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)||[]).map((f:any,i:number)=>(
              <tr key={i}>
                <td className="font-mono font-semibold">{f.fee_code}</td>
                <td>{f.fee_name}</td>
                <td><span className="badge-blue text-xs">{f.product_code}</span></td>
                <td><span className="badge-gray text-xs">{f.fee_type}</span></td>
                <td className="money">{f.fee_type==='flat'?`GHS ${(Number(f.flat_amount||0)/100).toFixed(2)}`:f.fee_type==='percentage'?`${(parseFloat(f.percentage_rate||'0')*100).toFixed(2)}%`:'Tiered'}</td>
                <td className="money text-xs">{f.min_amount?`GHS ${(Number(f.min_amount)/100).toFixed(2)}`:'—'}</td>
                <td className="money text-xs">{f.max_amount?`GHS ${(Number(f.max_amount)/100).toFixed(2)}`:'—'}</td>
                <td><span className={`badge text-xs ${f.is_active?'badge-green':'badge-gray'}`}>{f.is_active?'Active':'Inactive'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
