import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { ArrowLeft, CheckCircle2, XCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export function WorkflowDetailPage() {
  const { requestId } = useParams<{requestId:string}>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const nav = useNavigate();
  const { data, isLoading } = useQuery({ queryKey:['workflow',requestId], queryFn:()=>workflowApi.getOne(requestId!) });
  const d = data as any;

  const approve = useMutation({ mutationFn:(notes:string)=>workflowApi.approve(requestId!,notes), onSuccess:()=>{toast.success('Approved');qc.invalidateQueries({queryKey:['workflow',requestId]});}, onError:(e:any)=>toast.error(e.message) });
  const reject  = useMutation({ mutationFn:(notes:string)=>workflowApi.reject(requestId!,notes),  onSuccess:()=>{toast.success('Rejected');qc.invalidateQueries({queryKey:['workflow',requestId]});},  onError:(e:any)=>toast.error(e.message) });

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if (!d) return <div className="text-center py-20 text-slate-400">Request not found</div>;

  const req = d.request; const actions = d.actions||[];
  const canAct = req.status==='pending' && req.currentApproverRole===user?.role;

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="page-header"><button onClick={()=>nav(-1)} className="btn-ghost"><ArrowLeft size={16}/> Back</button><h1 className="page-title">Workflow Detail</h1></div>

      <div className="card">
        <div className="card-header">
          <div><p className="font-mono text-sm text-slate-500">{req.requestRef}</p><h3 className="font-bold text-slate-900 capitalize">{req.workflowType?.replace(/_/g,' ')}</h3></div>
          <span className={`badge ${req.status==='pending'?'badge-yellow':req.status==='approved'?'badge-green':'badge-red'}`}>{req.status}</span>
        </div>
        <div className="card-body">
          <dl className="grid grid-cols-2 gap-3 text-sm">
            {[['Entity Type',req.entityType],['Entity ID',req.entityId?.slice(0,16)+'…'],['Amount', req.amount?`GHS ${(Number(req.amount)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`:'—'],['Requestor',req.requestorId?.slice(0,12)+'…'],['Current Step',`${req.currentStep} of ${req.totalSteps}`],['Approver Role',req.currentApproverRole||'—'],['SLA',req.slaDeadline?new Date(req.slaDeadline).toLocaleString('en-GH'):'—'],['Created',new Date(req.createdAt).toLocaleString('en-GH')]].map(([l,v])=>(
              <div key={l}><dt className="text-slate-500">{l}</dt><dd className="font-medium">{v||'—'}</dd></div>
            ))}
          </dl>
          {req.notes && <div className="mt-3 p-3 bg-slate-50 rounded-lg text-sm italic text-slate-600">"{req.notes}"</div>}
        </div>
        {canAct && (
          <div className="px-6 pb-6 flex gap-3">
            <button onClick={()=>{const n=prompt('Approval notes (optional):');approve.mutate(n||'');}} disabled={approve.isPending} className="btn-success flex-1"><CheckCircle2 size={15}/> Approve</button>
            <button onClick={()=>{const n=prompt('Rejection reason (required):');if(n)reject.mutate(n);}} disabled={reject.isPending} className="btn-danger flex-1"><XCircle size={15}/> Reject</button>
          </div>
        )}
      </div>

      {actions.length>0 && (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Approval History</h3></div>
          <div className="card-body space-y-3">
            {actions.map((a:any)=>(
              <div key={a.actionId} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${a.action==='approve'?'bg-emerald-100':'bg-red-100'}`}>
                  {a.action==='approve'?<CheckCircle2 size={16} className="text-emerald-600"/>:<XCircle size={16} className="text-red-600"/>}
                </div>
                <div>
                  <p className="text-sm font-medium capitalize">{a.action} — <span className="text-slate-500">{a.actorRole}</span></p>
                  {a.notes && <p className="text-xs text-slate-500 italic">"{a.notes}"</p>}
                  <p className="text-xs text-slate-400"><Clock size={11} className="inline mr-0.5"/>{new Date(a.createdAt).toLocaleString('en-GH')}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
