import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { loansApi, customersApi } from '@api/index';
import { api } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import toast from 'react-hot-toast';

const schema = z.object({
  customerId:           z.string().min(1, 'Required'),
  productCode:          z.string().min(1, 'Required'),
  principalAmount:      z.number({ invalid_type_error: 'Enter amount' }).positive(),
  tenorMonths:          z.number({ invalid_type_error: 'Enter tenor' }).int().positive(),
  purpose:              z.string().optional(),
  sourceOfRepayment:    z.string().optional(),
  disbursementAccountId: z.string().min(1, 'Required'),
  guarantorReference:   z.string().optional(),
  collateralReference:  z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function LoanApplicationPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const { data: loanProducts } = useQuery({
    queryKey: ['loan-products'],
    queryFn: () => api.get('/configuration/loan-products').then(r => (r.data as any)?.data ?? r.data),
  });

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const customerId = watch('customerId');
  const { data: custAccounts } = useQuery({
    queryKey: ['cust-accounts', customerId],
    queryFn: () => customersApi.getAccounts(customerId),
    enabled: !!customerId && customerId.length > 30,
  });

  const onSubmit = async (data: Form) => {
    try {
      const loan = await loansApi.create({
        ...data,
        principalAmount: Math.round(data.principalAmount * 100),
        branchId: user?.branchId,
      });
      toast.success(`Loan application created: ${loan.loanNumber}`);
      navigate(`/loans/${loan.loanId}`);
    } catch (e: any) {
      toast.error(e.message || 'Failed to create application');
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">New Loan Application</h1>
          <p className="page-subtitle">Create a loan application for a customer</p>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="form-group col-span-2">
                <label className="label">Customer ID *</label>
                <input {...register('customerId')} className={`input ${errors.customerId ? 'input-error' : ''}`} placeholder="Paste customer UUID"/>
                {errors.customerId && <p className="form-error">{errors.customerId.message}</p>}
              </div>

              <div className="form-group">
                <label className="label">Loan Product *</label>
                <select {...register('productCode')} className={`input ${errors.productCode ? 'input-error' : ''}`}>
                  <option value="">Select product…</option>
                  {((loanProducts as any)||[]).map((p: any) => (
                    <option key={p.product_code} value={p.product_code}>
                      {p.product_name} — {(parseFloat(p.interest_rate_pa||'0')*100).toFixed(1)}% p.a. ({p.interest_method?.replace(/_/g,' ')})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="label">Disbursement Account *</label>
                <select {...register('disbursementAccountId')} className={`input ${errors.disbursementAccountId ? 'input-error' : ''}`}>
                  <option value="">Select account…</option>
                  {((custAccounts as any)||[]).map((a: any) => (
                    <option key={a.account_id} value={a.account_id}>
                      {a.account_number} — {a.account_type} (GHS {(Number(a.current_balance||0)/100).toFixed(2)})
                    </option>
                  ))}
                </select>
                {!customerId && <p className="form-error text-xs">Enter customer ID first to load accounts</p>}
              </div>

              <div className="form-group">
                <label className="label">Principal Amount (GHS) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">GHS</span>
                  <input {...register('principalAmount', { valueAsNumber: true })} type="number" step="0.01" className="input pl-12 font-mono" placeholder="0.00"/>
                </div>
              </div>

              <div className="form-group">
                <label className="label">Tenor (months) *</label>
                <input {...register('tenorMonths', { valueAsNumber: true })} type="number" min="1" className="input" placeholder="12"/>
              </div>

              <div className="form-group col-span-2">
                <label className="label">Purpose of Loan</label>
                <input {...register('purpose')} className="input" placeholder="e.g. Business expansion, home improvement"/>
              </div>

              <div className="form-group col-span-2">
                <label className="label">Source of Repayment</label>
                <input {...register('sourceOfRepayment')} className="input" placeholder="e.g. Monthly salary, business income"/>
              </div>

              <div className="form-group">
                <label className="label">Guarantor Reference</label>
                <input {...register('guarantorReference')} className="input" placeholder="Guarantor name / contact"/>
              </div>

              <div className="form-group">
                <label className="label">Collateral Reference</label>
                <input {...register('collateralReference')} className="input" placeholder="Asset description or ref no."/>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={isSubmitting} className="btn-primary flex-1">
                {isSubmitting ? 'Creating…' : 'Create Application'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
