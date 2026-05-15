import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { loansApi, customersApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

export function LoanRepaymentPage() {
  const { loanId } = useParams<{loanId:string}>();
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { data: loan } = useQuery({ queryKey:['loan',loanId], queryFn:()=>loansApi.getOne(loanId!) });
  const { data: schedule } = useQuery({ queryKey:['loan-schedule',loanId], queryFn:()=>loansApi.schedule(loanId!) });
  const { data: accounts } = useQuery({ queryKey:['cust-accounts',(loan as any)?.customerId], queryFn:()=>customersApi.getAccounts((loan as any)!.customerId), enabled:!!(loan as any)?.customerId });
  const { register, handleSubmit, formState:{ isSubmitting } } = useForm();
  const l = loan as any;

  const mut = useMutation({ mutationFn:(d:any)=>loansApi.repayment(loanId!,{...d, amount:Math.round(parseFloat(d.amount)*100)}), onSuccess:()=>{ toast.success('Repayment posted successfully'); nav(`/loans/${loanId}`); }, onError:(e:any)=>toast.error(e.message) });
  const nextDue = ((schedule as any)||[]).find((s:any)=>['scheduled','partial'].includes(s.status));
  const fmt = (v:any) => `GHS ${(Number(v||0)/100).toFixed(2)}`;

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header"><div><h1 className="page-title">Record Repayment</h1><p className="page-subtitle">{l?.loanNumber}</p></div></div>
      {nextDue && (
        <div className="card p-4 bg-blue-50 border-blue-200">
          <p className="text-sm font-semibold text-blue-800 mb-2">Next Installment Due</p>
          <div className="grid grid-cols-4 gap-2 text-sm">
            {[['#',nextDue.installmentNo],['Due Date',new Date(nextDue.dueDate).toLocaleDateString('en-GH')],['Total Due',fmt(nextDue.totalDue)],['Penalty',fmt(nextDue.penaltyDue)]].map(([k,v])=>(
              <div key={k}><p className="text-xs text-blue-600">{k}</p><p className="font-bold text-blue-900">{v}</p></div>
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Payment Details</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit(d=>mut.mutate(d))} className="space-y-4">
            <div className="form-group">
              <label className="label">Source Account *</label>
              <select {...register('sourceAccountId',{required:true})} className="input">
                <option value="">Select account…</option>
                {((accounts as any)||[]).map((a:any)=><option key={a.account_id} value={a.account_id}>{a.account_number} — Bal: {fmt(a.current_balance)}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">Amount (GHS) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">GHS</span>
                <input {...register('amount',{required:true})} type="number" step="0.01" className="input pl-12 font-mono text-lg" placeholder={nextDue ? (Number(nextDue.totalDue)/100).toFixed(2) : '0.00'}/>
              </div>
            </div>
            <input {...register('narration')} className="input" placeholder="Narration (optional)"/>
            <div className="bg-amber-50 rounded-lg p-3 text-xs text-amber-700">Payment allocation order: Penalty → Interest → Principal</div>
            <div className="flex gap-3">
              <button type="button" onClick={()=>nav(-1)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting?'Posting…':'Post Repayment'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
