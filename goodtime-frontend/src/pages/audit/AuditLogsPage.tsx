import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { auditApi } from '@api/index';
import { Download } from 'lucide-react';

const ACTION_TYPES = ['USER_LOGIN','USER_LOGOUT','ACCOUNT_CREATED','ACCOUNT_FROZEN','CUSTOMER_CREATED','LOAN_APPROVED','LOAN_DISBURSED','LOAN_REPAYMENT_POSTED','LOAN_WRITTEN_OFF','FD_PLACED','FD_EARLY_BROKEN','PASSWORD_CHANGED','KYC_STATUS_UPDATED','CUSTOMER_FROZEN','DRAWER_OPENED','DRAWER_CLOSED','RECON_EXCEPTION_RESOLVED','END_OF_DAY_COMPLETE'];
const ENTITY_TYPES = ['user','customer','account','loan','fixed_deposit','transaction','drawer','reconciliation_exception'];

export function AuditLogsPage() {
  const [f, setF] = useState({ actionType:'', entityType:'', fromDate:'', toDate:'', page:1 });
  const { data, isLoading } = useQuery({ queryKey:['audit',f], queryFn:()=>auditApi.search(f) });
  const rows = (data as any)?.data||[];
  const meta = (data as any)?.meta;

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Audit Logs</h1><p className="page-subtitle">Immutable record of all system actions</p></div>
        <a href={`/api/v1/audit/export?actionType=${f.actionType}&entityType=${f.entityType}&fromDate=${f.fromDate}&toDate=${f.toDate}`} className="btn-secondary"><Download size={15}/> Export CSV</a>
      </div>

      <div className="card p-4">
        <div className="grid grid-cols-4 gap-3">
          <select className="input" value={f.actionType} onChange={e=>setF(p=>({...p,actionType:e.target.value,page:1}))}>
            <option value="">All Actions</option>
            {ACTION_TYPES.map(a=><option key={a} value={a}>{a.replace(/_/g,' ')}</option>)}
          </select>
          <select className="input" value={f.entityType} onChange={e=>setF(p=>({...p,entityType:e.target.value,page:1}))}>
            <option value="">All Entities</option>
            {ENTITY_TYPES.map(e=><option key={e} value={e}>{e.replace(/_/g,' ')}</option>)}
          </select>
          <input type="date" className="input" value={f.fromDate} onChange={e=>setF(p=>({...p,fromDate:e.target.value}))} placeholder="From"/>
          <input type="date" className="input" value={f.toDate}   onChange={e=>setF(p=>({...p,toDate:e.target.value}))} placeholder="To"/>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead><tr><th>Timestamp</th><th>Actor</th><th>Role</th><th>Action</th><th>Entity</th><th>Entity ID</th><th>Description</th><th>IP</th></tr></thead>
          <tbody>
            {isLoading ? <tr><td colSpan={8} className="text-center py-8"><div className="animate-spin w-6 h-6 border-4 border-blue-600 border-t-transparent rounded-full mx-auto"/></td></tr>
            : rows.length===0 ? <tr><td colSpan={8} className="text-center py-8 text-slate-400">No audit logs found</td></tr>
            : rows.map((log:any)=>(
              <tr key={log.auditId}>
                <td className="text-xs font-mono text-slate-500">{new Date(log.createdAt).toLocaleString('en-GH')}</td>
                <td className="text-xs font-mono">{log.actorUserId?.slice(0,8)}…</td>
                <td><span className="badge-gray text-xs">{log.actorRole}</span></td>
                <td><span className="text-xs font-semibold text-blue-700">{log.actionType}</span></td>
                <td className="text-xs capitalize">{log.entityType?.replace(/_/g,' ')}</td>
                <td className="font-mono text-xs text-slate-400">{log.entityId?.slice(0,12)}…</td>
                <td className="text-xs text-slate-500 max-w-xs truncate">{log.description||'—'}</td>
                <td className="font-mono text-xs text-slate-400">{log.ipAddress||'—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{((f.page-1)*50)+1}–{Math.min(f.page*50,meta.total)} of {meta.total.toLocaleString()}</span>
          <div className="flex gap-2">
            <button onClick={()=>setF(p=>({...p,page:Math.max(1,p.page-1)}))} disabled={f.page===1} className="btn-secondary btn-sm">Previous</button>
            <button onClick={()=>setF(p=>({...p,page:p.page+1}))} disabled={f.page*50>=meta.total} className="btn-secondary btn-sm">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
