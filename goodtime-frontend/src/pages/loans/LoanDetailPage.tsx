import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { loansApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { CheckCircle2, XCircle, Send, DollarSign, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

const fmt = (v: any) => `GHS ${(Number(v||0)/100).toLocaleString('en-GH',{minimumFractionDigits:2})}`;

export function LoanDetailPage() {
  const { loanId } = useParams<{loanId:string}>();
  const { user } = useAuthStore();
  const qc = useQueryClient();
  const nav = useNavigate();

  const { data: loan, isLoading } = useQuery({ queryKey:['loan',loanId], queryFn:()=>loansApi.getOne(loanId!) });
  const { data: schedule } = useQuery({ queryKey:['loan-schedule',loanId], queryFn:()=>loansApi.schedule(loanId!), enabled:!!loan && ['active','in_arrears','closed','disbursed'].includes((loan as any)?.status) });

  const mutOpts = (msg: string) => ({ onSuccess:()=>{toast.success(msg);qc.invalidateQueries({queryKey:['loan',loanId]});}, onError:(e:any)=>toast.error(e.message) });
  const submit   = useMutation({ mutationFn:()=>loansApi.submit(loanId!),   ...mutOpts('Submitted for review') });
  const approve  = useMutation({ mutationFn:()=>loansApi.approve(loanId!,{}), ...mutOpts('Loan approved') });
  const reject   = useMutation({ mutationFn:(reason:string)=>loansApi.reject(loanId!,reason), ...mutOpts('Loan rejected') });
  const disburse = useMutation({ mutationFn:()=>loansApi.disburse(loanId!), ...mutOpts('Loan disbursed') });

  if (isLoading) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;
  if (!loan) return <div className="text-center py-20 text-slate-400">Loan not found</div>;
  const l = loan as any;

  const statusBadge = (s:string) => { const m:Record<string,string>={active:'badge-green',approved:'badge-blue',submitted:'badge-blue',in_arrears:'badge-yellow',default:'badge-red',closed:'badge-gray',draft:'badge-gray'}; return <span className={m[s]||'badge-gray'}>{s.replace(/_/g,' ')}</span>; };
  const isManager = ['branch_manager','admin','super_admin'].includes(user?.role||'');
  const isAdmin   = ['admin','super_admin'].includes(user?.role||'');

  return (
    <div className="space-y-5 max-w-5xl">
      <div className="page-header">
        <div><h1 className="page-title font-mono">{l.loanNumber}</h1><p className="page-subtitle capitalize">{statusBadge(l.status)} · {l.productCode}</p></div>
        <div className="flex gap-2">
          {l.status==='draft'      && <button onClick={()=>submit.mutate()} disabled={submit.isPending} className="btn-primary"><Send size={15}/> Submit</button>}
          {l.status==='submitted'  && isManager && <><button onClick={()=>approve.mutate()} disabled={approve.isPending} className="btn-success"><CheckCircle2 size={15}/> Approve</button><button onClick={()=>{const r=prompt('Rejection reason:');if(r)reject.mutate(r);}} className="btn-danger"><XCircle size={15}/> Reject</button></>}
          {l.status==='approved'   && isAdmin   && <button onClick={()=>{if(confirm('Confirm disbursement?'))disburse.mutate();}} disabled={disburse.isPending} className="btn-success"><DollarSign size={15}/> Disburse</button>}
          {['active','in_arrears'].includes(l.status) && <Link to={`/loans/${loanId}/repayment`} className="btn-primary"><DollarSign size={15}/> Record Repayment</Link>}
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        {[['Principal',l.principalAmount,'text-slate-900'],['Outstanding',l.outstandingPrincipal,'text-blue-700'],['Accrued Interest',l.accruedInterest,'text-amber-600'],['Accrued Penalty',l.accruedPenalty,l.accruedPenalty>0?'text-red-600':'text-slate-400']].map(([lbl,val,cls])=>(
          <div key={lbl as string} className="card p-4"><p className="text-xs text-slate-500 mb-1">{lbl}</p><p className={`text-lg font-bold money ${cls}`}>{fmt(val)}</p></div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Loan Details</h3></div>
          <div className="card-body">
            <dl className="space-y-3 text-sm">
              {[['Loan Number',l.loanNumber,true],['Product',l.productCode],['Rate',(parseFloat(l.interestRatePa||'0')*100).toFixed(2)+'% p.a.'],['Method',l.interestMethod?.replace(/_/g,' ')],['Tenor',`${l.tenorMonths} months`],['Grace',`${l.gracePeriodDays} days`],['Disbursed',l.disbursementDate?new Date(l.disbursementDate).toLocaleDateString('en-GH'):'—'],['Maturity',l.maturityDate?new Date(l.maturityDate).toLocaleDateString('en-GH'):'—'],['Risk Grade',l.riskGrade||'—'],['Days Arrears',l.daysInArrears]].map(([label,value,mono]: any)=>(
                <div key={label} className="flex justify-between"><dt className="text-slate-500">{label}</dt><dd className={`font-medium ${mono?'font-mono':''}`}>{value}</dd></div>
              ))}
            </dl>
          </div>
        </div>

        {schedule && (
          <div className="card">
            <div className="card-header"><h3 className="font-semibold">Repayment Schedule</h3><span className="badge-blue text-xs">{((schedule as any)||[]).filter((s:any)=>s.status==='paid').length}/{((schedule as any)||[]).length} paid</span></div>
            <div className="overflow-y-auto max-h-80">
              <table className="data-table text-xs">
                <thead><tr><th>#</th><th>Due Date</th><th>Principal</th><th>Interest</th><th>Penalty</th><th>Total</th><th>Status</th></tr></thead>
                <tbody>
                  {((schedule as any)||[]).map((s:any)=>(
                    <tr key={s.scheduleId} className={s.status==='paid'?'bg-emerald-50':s.status==='overdue'?'bg-red-50':''}>
                      <td className="font-mono">{s.installmentNo}</td>
                      <td>{new Date(s.dueDate).toLocaleDateString('en-GH')}</td>
                      <td className="money">{(Number(s.principalDue)/100).toFixed(2)}</td>
                      <td className="money">{(Number(s.interestDue)/100).toFixed(2)}</td>
                      <td className={`money ${s.penaltyDue>0?'text-red-600':'text-slate-300'}`}>{(Number(s.penaltyDue)/100).toFixed(2)}</td>
                      <td className="money font-semibold">{(Number(s.totalDue)/100).toFixed(2)}</td>
                      <td><span className={`badge ${s.status==='paid'?'badge-green':s.status==='overdue'?'badge-red':s.status==='partial'?'badge-yellow':'badge-gray'}`}>{s.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
