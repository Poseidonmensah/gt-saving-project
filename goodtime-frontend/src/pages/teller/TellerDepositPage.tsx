import { useState, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { txnApi, accountsApi } from '@api/index';
import { CheckCircle, AlertTriangle, Printer, Search } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  accountNumber: z.string().min(10, 'Enter valid account number'),
  customerName:  z.string().min(2, 'Customer name required'),
  amount:        z.number({ invalid_type_error: 'Enter amount' }).positive('Must be positive'),
  narration:     z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function TellerDepositPage() {
  const [result, setResult]       = useState<any>(null);
  const [account, setAccount]     = useState<any>(null);
  const [lookupLoading, setLL]    = useState(false);
  const ikey = useRef(`DEP-${Date.now()}-${Math.random().toString(36).slice(2)}`);

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
      const res = await txnApi.deposit({ ...data, amount: Math.round(data.amount * 100) }, ikey.current);
      setResult(res);
      toast.success(`Deposit posted: ${res.transactionRef}`);
      ikey.current = `DEP-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    } catch (e: any) { toast.error(e.message); }
  };

  if (result) return (
    <div className="max-w-lg mx-auto">
      <div className="card p-8 text-center">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-emerald-600"/></div>
        <h2 className="text-xl font-bold mb-1">Deposit Successful</h2>
        <p className="text-slate-500 text-sm mb-6">Transaction posted to account</p>
        <div className="bg-slate-50 rounded-xl p-4 text-left space-y-3 mb-6 text-sm">
          {[['Reference', result.transactionRef, true], ['Amount (GHS)', (Number(result.amount)/100).toFixed(2)], ['Fee (GHS)', (Number(result.fees||0)/100).toFixed(2)], ['Net Credit (GHS)', (Number(result.netAmount)/100).toFixed(2)], ['Date & Time', new Date().toLocaleString('en-GH')]].map(([l,v,mono]: any) => (
            <div key={l} className="flex justify-between"><span className="text-slate-500">{l}</span><span className={`font-medium ${mono ? 'font-mono text-blue-700' : ''}`}>{v}</span></div>
          ))}
        </div>
        <div className="flex gap-3">
          <button onClick={() => window.print()} className="btn-secondary flex-1"><Printer size={15}/> Print Receipt</button>
          <button onClick={() => { setResult(null); setAccount(null); reset(); }} className="btn-primary flex-1">New Deposit</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto">
      <div className="page-header"><div><h1 className="page-title">Teller Deposit</h1><p className="page-subtitle">Post cash deposit to customer account</p></div></div>
      <div className="card">
        <div className="card-header"><h3 className="font-semibold">Deposit Details</h3><span className="badge-yellow">Name Verification Required</span></div>
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="form-group">
              <label className="label">Account Number *</label>
              <div className="flex gap-2">
                <input {...register('accountNumber')} className={`input flex-1 font-mono ${errors.accountNumber ? 'input-error' : ''}`} placeholder="0000000000" maxLength={10}/>
                <button type="button" onClick={lookup} disabled={lookupLoading} className="btn-secondary px-4">
                  {lookupLoading ? <span className="animate-spin w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full inline-block"/> : <Search size={16}/>}
                </button>
              </div>
              {errors.accountNumber && <p className="form-error">{errors.accountNumber.message}</p>}
            </div>

            {account && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                <p className="text-xs text-blue-600 font-medium mb-1">Account Found</p>
                <p className="font-semibold">{account.accountType?.toUpperCase()} · {account.status}</p>
                <p className="text-slate-500">Balance: GHS {(Number(account.currentBalance)/100).toFixed(2)}</p>
              </div>
            )}

            <div className="form-group">
              <label className="label">Customer Name * <span className="text-amber-600 text-xs font-normal">(must match records)</span></label>
              <input {...register('customerName')} className={`input ${errors.customerName ? 'input-error' : ''}`} placeholder="Account holder full name"/>
              {errors.customerName && <p className="form-error">{errors.customerName.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Amount (GHS) *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">GHS</span>
                <input {...register('amount', { valueAsNumber: true })} type="number" step="0.01" min="0.01" className={`input pl-12 font-mono text-lg ${errors.amount ? 'input-error' : ''}`} placeholder="0.00"/>
              </div>
              {errors.amount && <p className="form-error">{errors.amount.message}</p>}
            </div>

            <div className="form-group">
              <label className="label">Narration</label>
              <input {...register('narration')} className="input" placeholder="Optional description"/>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5"/>
              <p className="text-xs text-amber-700">Verify customer identity. Name mismatch will reject transaction. This deposit is logged with your teller ID.</p>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-success w-full py-3 text-base">
              {isSubmitting ? 'Processing...' : 'Post Deposit'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
