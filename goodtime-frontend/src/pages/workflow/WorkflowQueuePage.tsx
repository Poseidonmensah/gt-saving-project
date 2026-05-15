import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { workflowApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export function WorkflowQueuePage() {
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey:['workflow-queue'], queryFn: workflowApi.getAll, refetchInterval: 30000 });
  const rows = (data as any)?.data || (Array.isArray(data) ? data : []);

  const approve = useMutation({ mutationFn:({id,notes}:any)=>workflowApi.approve(id,notes), onSuccess:()=>{toast.success('Approved');qc.invalidateQueries({queryKey:['workflow-queue']});}, onError:(e:any)=>toast.error(e.message) });
  const reject  = useMutation({ mutationFn:({id,notes}:any)=>workflowApi.reject(id,notes),  onSuccess:()=>{toast.success('Rejected');qc.invalidateQueries({queryKey:['workflow-queue']});}, onError:(e:any)=>toast.error(e.message) });

  const statusBadge=(s:string)=>{ const m:Record<string,string>={pending:'badge-yellow',approved:'badge-green',rejected:'badge-red',escalated:'badge-orange'}; return <span className={m[s]||'badge-gray'}>{s}</span>; };

  return (
    <div className="space-y-5">
      <div className="page-header">
        <div><h1 className="page-title">Pending Approvals</h1><p className="page-subtitle">Workflow requests requiring your action</p></div>
        <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1.5 rounded-full">
          {rows.filter((r:any)=>r.status==='pending').length} pending
        </span>
      </div>

      {isLoading ? <div className="flex justify-center py-12"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>
      : rows.length===0 ? (
        <div className="card p-12 text-center">
          <CheckCircle2 size={48} className="mx-auto text-emerald-300 mb-4"/>
          <p className="text-slate-500 font-medium">All caught up! No pending approvals.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((req:any) => (
            <div key={req.requestId} className="card p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-mono text-xs text-slate-400">{req.requestRef}</span>
                    {statusBadge(req.status)}
                    {req.priority<=2 && <span className="badge-red">High Priority</span>}
                  </div>
                  <p className="font-semibold text-slate-900 capitalize">{req.workflowType?.replace(/_/g,' ')}</p>
                  <p className="text-sm text-slate-500 mt-0.5">{req.entityType}: <Link to={`/workflow/${req.requestId}`} className="text-blue-600 hover:underline">{req.entityId?.slice(0,12)}…</Link></p>
                  {req.amount && <p className="text-sm font-semibold text-blue-700 mt-1 font-mono">GHS {(Number(req.amount)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}</p>}
                  {req.notes && <p className="text-xs text-slate-400 mt-1 italic">"{req.notes}"</p>}
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                    <span><Clock size={11} className="inline mr-0.5"/>{new Date(req.createdAt).toLocaleString('en-GH')}</span>
                    {req.slaDeadline && <span>SLA: {new Date(req.slaDeadline).toLocaleString('en-GH')}</span>}
                  </div>
                </div>
                {req.status==='pending' && req.currentApproverRole===user?.role && (
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={()=>approve.mutate({id:req.requestId})} disabled={approve.isPending} className="btn-success btn-sm"><CheckCircle2 size={14}/> Approve</button>
                    <button onClick={()=>{const n=prompt('Rejection reason (required):');if(n)reject.mutate({id:req.requestId,notes:n});}} disabled={reject.isPending} className="btn-danger btn-sm"><XCircle size={14}/> Reject</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
