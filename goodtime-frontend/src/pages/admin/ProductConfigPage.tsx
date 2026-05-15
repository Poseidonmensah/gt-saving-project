import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@api/index';
import { useState } from 'react';
import toast from 'react-hot-toast';

export function ProductConfigPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:['products'], queryFn: adminApi.getProducts });
  const [editing, setEditing] = useState<any>(null);

  const update = useMutation({
    mutationFn: () => adminApi.updateProduct(editing.product_code, { interestRatePa: editing.interest_rate_pa, minimumBalance: editing.minimum_balance }),
    onSuccess: () => { toast.success('Product updated'); qc.invalidateQueries({queryKey:['products']}); setEditing(null); },
    onError: (e:any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Product Configuration</h1><p className="page-subtitle">Savings, fixed deposit and loan product settings</p></div></div>
      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Name</th><th>Type</th><th>Rate (p.a.)</th><th>Min Balance</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)||[]).map((p:any)=>(
              <tr key={p.product_code}>
                <td className="font-mono font-semibold text-blue-700">{p.product_code}</td>
                <td className="font-medium">{p.product_name}</td>
                <td><span className="badge-blue text-xs">{p.product_type}</span></td>
                <td className="money">{(parseFloat(p.interest_rate_pa||'0')*100).toFixed(2)}%</td>
                <td className="money">GHS {(Number(p.minimum_balance||0)/100).toFixed(2)}</td>
                <td><span className={`badge text-xs ${p.is_active?'badge-green':'badge-gray'}`}>{p.is_active?'Active':'Inactive'}</span></td>
                <td><button onClick={()=>setEditing({...p})} className="text-blue-600 text-sm hover:underline">Edit</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="card w-full max-w-md p-6 space-y-4">
            <h3 className="font-bold text-lg">Edit {editing.product_name}</h3>
            <div className="form-group"><label className="label">Interest Rate p.a.</label><input type="number" step="0.001" value={editing.interest_rate_pa} onChange={e=>setEditing((d:any)=>({...d,interest_rate_pa:e.target.value}))} className="input"/></div>
            <div className="form-group"><label className="label">Minimum Balance (pesewas)</label><input type="number" value={editing.minimum_balance} onChange={e=>setEditing((d:any)=>({...d,minimum_balance:e.target.value}))} className="input"/></div>
            <div className="flex gap-3"><button onClick={()=>setEditing(null)} className="btn-secondary flex-1">Cancel</button><button onClick={()=>update.mutate()} disabled={update.isPending} className="btn-primary flex-1">{update.isPending?'Saving…':'Save'}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
