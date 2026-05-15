import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { txnApi, accountsApi } from '@api/index';
import { CheckCircle, AlertTriangle, Search, Printer } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  accountNumber: z.string().min(10),
  customerName:  z.string().min(2),
  amount:        z.number({ invalid_type_error: 'Enter amount' }).positive(),
  narration:     z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function TellerWithdrawalPage() {
  const [result, setResult]   = useState<any>(null);
  const [account, setAccount] = useState<any>(null);
  const [ll, setLL]           = useState(false);
  const ikey = useRef(`WDR-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting }, reset } = useForm<Form>({ resolver: zodResolver(schema) });
  const accNum = watch('accountNumber');

  const lookup = async () => {
    if ((accNum||'').length < 10) return;
    setLL(true);
    try { setAccount(await accountsApi.byNumber(accNum)); }
    catch { toast.error('Account not found'); }
    finally { setLL(false); }
  };

  const onSubmit = async (data: Form) => {
    try {
      const res = await txnApi.withdrawal({ ...data, amount: Math.round(data.amount * 100) }, ikey.current);
      if (res.status === 'pending_approval') {
        toast.success('Withdrawal requires approval — request submitted');
        reset(); setAccount(null);
      } else {
        setResult(res);
        toast.success(`Withdrawal posted: ${res.transactionRef}`);
      }
      ikey.current = `WDR-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch (e: any) { toast.error(e.message); }
  };

  if (result) return (
    <div className="max-w-lg mx-auto">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-blue-600"/></div>
        <h2 className="text-xl font-bold mb-1">Withdrawal Successful</h2>
        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6 text-sm">
          {[['Reference', result.transactionRef, true], ['Amount (GHS)', (Number(result.amount)/100).toFixed(2)], ['Date & Time', new Date().toLocaleString('en-GH')]].map(([l,v,mono]: any) => (
            <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className={`font-medium ${mono?'font-mono text-blue-700':''}`}>{v}</span></div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn-secondary flex-1"><Printer size={15}/> Print</button>
          <button onClick={() => { setResult(null); setAccount(null); reset(); }} className="btn-primary flex-1">New Withdrawal</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="page-header"><div><h1 className="page-title">Teller Withdrawal</h1><p className="page-subtitle">Process cash withdrawal from customer account</p></div></div>
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Withdrawal Details</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-group">
              <label className="label">Account Number *</label>
              <div className="flex gap-2">
                <input {...register('accountNumber')} className="input flex-1 font-mono" placeholder="0000000000" maxLength={10}/>
                <button type="button" onClick={lookup} disabled={ll} className="btn-secondary px-4">
                  {ll ? <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block"/> : <Search size={16}/>}
                </button>
              </div>
            </div>
            {account && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-xs text-blue-600 font-medium mb-1">Account Found</p>
                <p className="text-slate-500">Available: <strong className="text-slate-900">GHS {(Number(account.availableBalance)/100).toFixed(2)}</strong></p>
              </div>
            )}
            <div className="form-group">
              <label className="label">Customer Name * <span className="text-amber-600 text-xs font-normal">(identity verification)</span></label>
              <input {...register('customerName')} className={`input ${errors.customerName ? 'input-error' : ''}`} placeholder="Account holder full name"/>
            </div>
            <div className="form-group">
              <label className="label">Amount (GHS) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">GHS</span>
                <input {...register('amount', { valueAsNumber: true })} type="number" step="0.01" min="0.01" className="input pl-12 font-mono text-lg" placeholder="0.00"/>
              </div>
            </div>
            <input {...register('narration')} className="input" placeholder="Narration (optional)"/>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-700">High-value withdrawals above threshold will route for supervisor approval automatically.</p>
            </div>
            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3">
              {isSubmitting ? 'Processing...' : 'Process Withdrawal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
