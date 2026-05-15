import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { fdApi, adminApi, customersApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

export function FDPlacementPage() {
  const nav = useNavigate();
  const { user } = useAuthStore();
  const { data: products } = useQuery({ queryKey:['fd-products'], queryFn:()=>adminApi.getProducts().then((d:any[])=>d.filter(p=>p.product_type==='fixed_deposit')) });
  const { register, handleSubmit, watch, formState:{ errors, isSubmitting } } = useForm();
  const customerId = watch('customerId');
  const { data: accounts } = useQuery({ queryKey:['cust-accts',customerId], queryFn:()=>customersApi.getAccounts(customerId), enabled:!!customerId });

  const onSubmit = async (data: any) => {
    try {
      const fd = await fdApi.place({ ...data, principalAmount: Math.round(parseFloat(data.principalAmount)*100) });
      toast.success(`FD placed: ${fd.fdNumber}`);
      nav(`/fixed-deposits/${fd.fdId}`);
    } catch(e:any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header"><div><h1 className="page-title">Place Fixed Deposit</h1><p className="page-subtitle">Create a new fixed deposit for a customer</p></div></div>
      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-group"><label className="label">Customer ID *</label><input {...register('customerId',{required:true})} className="input" placeholder="Paste customer ID"/></div>
            <div className="form-group"><label className="label">Source Account *</label><select {...register('sourceAccountId',{required:true})} className="input"><option value="">Select account…</option>{((accounts as any)||[]).map((a:any)=><option key={a.account_id} value={a.account_id}>{a.account_number} — GHS {(Number(a.current_balance)/100).toFixed(2)}</option>)}</select></div>
            <div className="form-group"><label className="label">FD Product *</label><select {...register('productCode',{required:true})} className="input"><option value="">Select product…</option>{((products as any)||[]).map((p:any)=><option key={p.product_code} value={p.product_code}>{p.product_name} — {(parseFloat(p.interest_rate_pa)*100).toFixed(1)}% p.a. for {p.min_tenor_days} days</option>)}</select></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group"><label className="label">Principal Amount (GHS) *</label><input {...register('principalAmount',{required:true})} type="number" step="0.01" className="input font-mono" placeholder="0.00"/></div>
              <div className="form-group"><label className="label">Tenor (days) *</label><input {...register('tenorDays',{required:true,valueAsNumber:true})} type="number" className="input" placeholder="90"/></div>
            </div>
            <div className="form-group"><label className="label">Maturity Instruction</label><select {...register('maturityInstruction')} className="input"><option value="payout">Payout to source account</option><option value="rollover">Auto-rollover principal</option><option value="rollover_with_interest">Rollover principal + interest</option></select></div>
            <div className="flex items-center gap-2"><input {...register('autoRollover')} type="checkbox" className="w-4 h-4"/><label className="text-sm text-slate-700">Enable auto-rollover</label></div>
            <div className="flex gap-3"><button type="button" onClick={()=>nav(-1)} className="btn-secondary flex-1">Cancel</button><button type="submit" disabled={isSubmitting} className="btn-primary flex-1">{isSubmitting?'Placing…':'Place Fixed Deposit'}</button></div>
          </form>
        </div>
      </div>
    </div>
  );
}
