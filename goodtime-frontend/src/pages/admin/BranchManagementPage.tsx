import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@api/index';
import { Plus } from 'lucide-react';
import toast from 'react-hot-toast';

export function BranchManagementPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ branchCode:'', branchName:'', region:'', address:'', phone:'', email:'' });
  const { data, isLoading } = useQuery({ queryKey:['branches'], queryFn: adminApi.getBranches });

  const create = useMutation({
    mutationFn: () => adminApi.createBranch(form),
    onSuccess: () => { toast.success('Branch created'); qc.invalidateQueries({queryKey:['branches']}); setShowNew(false); setForm({branchCode:'',branchName:'',region:'',address:'',phone:'',email:''}); },
    onError: (e:any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">Branch Management</h1><p className="page-subtitle">Manage branch network</p></div><button onClick={()=>setShowNew(s=>!s)} className="btn-primary"><Plus size={16}/> New Branch</button></div>

      {showNew && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Create Branch</h3></div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {([['branchCode','Branch Code'],['branchName','Branch Name'],['region','Region'],['address','Address'],['phone','Phone'],['email','Email']] as const).map(([k,l])=>(
                <div key={k} className="form-group"><label className="label">{l}</label><input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className="input"/></div>
              ))}
            </div>
            <div className="flex gap-3 mt-4"><button onClick={()=>setShowNew(false)} className="btn-secondary flex-1">Cancel</button><button onClick={()=>create.mutate()} disabled={create.isPending} className="btn-primary flex-1">{create.isPending?'Creating…':'Create Branch'}</button></div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Code</th><th>Branch Name</th><th>Region</th><th>Address</th><th>Phone</th><th>Email</th><th>Status</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={7} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : ((data as any)||[]).map((b:any)=>(
              <tr key={b.branch_id}>
                <td className="font-mono font-bold text-blue-700">{b.branch_code}</td>
                <td className="font-medium">{b.branch_name}</td>
                <td>{b.region}</td>
                <td className="text-sm text-slate-500">{b.address}</td>
                <td className="font-mono text-sm">{b.phone}</td>
                <td className="text-sm text-slate-500">{b.email}</td>
                <td><span className={`badge text-xs ${b.status==='active'?'badge-green':'badge-gray'}`}>{b.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
