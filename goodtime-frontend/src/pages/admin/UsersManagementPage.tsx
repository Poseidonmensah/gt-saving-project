import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi } from '@api/index';
import { Plus, Lock, Unlock } from 'lucide-react';
import toast from 'react-hot-toast';

const ROLES = ['super_admin','admin','branch_manager','teller','loan_officer','credit_analyst','accountant','auditor','compliance_officer','customer_care'];

export function UsersManagementPage() {
  const qc = useQueryClient();
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ username:'', fullName:'', email:'', role:'teller', branchId:'', password:'' });
  const { data, isLoading } = useQuery({ queryKey:['users'], queryFn:()=>adminApi.getUsers() });
  const users = (data as any)?.data || (Array.isArray(data) ? data : []);

  const create = useMutation({ mutationFn:()=>adminApi.createUser(form), onSuccess:()=>{toast.success('User created');qc.invalidateQueries({queryKey:['users']});setShowNew(false);setForm({username:'',fullName:'',email:'',role:'teller',branchId:'',password:'Admin@2026!'});}, onError:(e:any)=>toast.error(e.message) });
  const unlock = useMutation({ mutationFn:(id:string)=>adminApi.unlockUser(id), onSuccess:()=>{toast.success('User unlocked');qc.invalidateQueries({queryKey:['users']});}, onError:(e:any)=>toast.error(e.message) });
  const reset  = useMutation({ mutationFn:(id:string)=>{const p=prompt('New temporary password:');if(!p)throw new Error('Cancelled');return adminApi.resetPassword(id,p);}, onSuccess:()=>toast.success('Password reset'), onError:(e:any)=>toast.error(e.message) });

  return (
    <div className="space-y-5">
      <div className="page-header"><div><h1 className="page-title">User Management</h1><p className="page-subtitle">System users and role assignments</p></div><button onClick={()=>setShowNew(s=>!s)} className="btn-primary"><Plus size={16}/> New User</button></div>

      {showNew && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Create New User</h3></div>
          <div className="card-body">
            <div className="grid grid-cols-2 gap-4">
              {([['username','Username'],['fullName','Full Name'],['email','Email'],['password','Temp Password']] as const).map(([k,l])=>(
                <div key={k} className="form-group"><label className="label">{l}</label><input value={(form as any)[k]} onChange={e=>setForm(f=>({...f,[k]:e.target.value}))} className="input" placeholder={l}/></div>
              ))}
              <div className="form-group"><label className="label">Role</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} className="input">{ROLES.map(r=><option key={r} value={r}>{r.replace(/_/g,' ')}</option>)}</select></div>
              <div className="form-group"><label className="label">Branch ID</label><input value={form.branchId} onChange={e=>setForm(f=>({...f,branchId:e.target.value}))} className="input" placeholder="Branch ID"/></div>
            </div>
            <div className="flex gap-3 mt-4"><button onClick={()=>setShowNew(false)} className="btn-secondary flex-1">Cancel</button><button onClick={()=>create.mutate()} disabled={create.isPending} className="btn-primary flex-1">{create.isPending?'Creating…':'Create User'}</button></div>
          </div>
        </div>
      )}

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Username</th><th>Full Name</th><th>Email</th><th>Role</th><th>Branch</th><th>MFA</th><th>Status</th><th>Actions</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : users.map((u:any)=>(
              <tr key={u.userId}>
                <td className="font-mono font-semibold">{u.username}</td>
                <td className="font-medium">{u.fullName}</td>
                <td className="text-sm text-slate-500">{u.email}</td>
                <td><span className="badge-blue text-xs">{u.role?.replace(/_/g,' ')}</span></td>
                <td className="text-xs text-slate-500">{u.branchId?.slice(0,8)||'—'}</td>
                <td><span className={`badge text-xs ${u.mfaEnabled?'badge-green':'badge-gray'}`}>{u.mfaEnabled?'ON':'OFF'}</span></td>
                <td><span className={`badge text-xs ${u.status==='active'?'badge-green':u.status==='locked'?'badge-red':'badge-gray'}`}>{u.status}</span></td>
                <td>
                  <div className="flex gap-1">
                    {u.status==='locked' && <button onClick={()=>unlock.mutate(u.userId)} className="btn-ghost btn-sm text-xs"><Unlock size={12}/></button>}
                    <button onClick={()=>reset.mutate(u.userId)} className="btn-ghost btn-sm text-xs"><Lock size={12}/> Reset PW</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
