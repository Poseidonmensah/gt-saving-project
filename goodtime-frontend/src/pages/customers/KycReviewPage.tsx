import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { customersApi } from '@api/index';
import toast from 'react-hot-toast';
import { ShieldCheck, FileText, ArrowLeft } from 'lucide-react';

export function KycReviewPage() {
  const { customerId } = useParams<{ customerId: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: customer } = useQuery({ queryKey: ['customer', customerId], queryFn: () => customersApi.getOne(customerId!) });
  const { register, handleSubmit } = useForm({ defaultValues: { status: 'approved', tier: 'tier_1', notes: '' } });

  const mutation = useMutation({
    mutationFn: (data: any) => customersApi.kycReview(customerId!, data),
    onSuccess: () => { toast.success('KYC status updated'); qc.invalidateQueries({ queryKey: ['customer', customerId] }); navigate(`/customers/${customerId}`); },
    onError: (e: any) => toast.error(e.message),
  });

  if (!customer) return <div className="flex justify-center py-20"><div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"/></div>;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="page-header">
        <button onClick={() => navigate(-1)} className="btn-ghost"><ArrowLeft size={16}/> Back</button>
        <h1 className="page-title">KYC Review</h1>
      </div>

      <div className="card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
            {customer.fullName?.charAt(0)}
          </div>
          <div>
            <p className="font-semibold text-slate-900">{customer.fullName}</p>
            <p className="text-sm text-slate-500">{customer.customerNumber} · {customer.phoneNumber}</p>
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[['ID Type', customer.idType], ['ID Number', customer.idNumber], ['Date of Birth', customer.dateOfBirth ? new Date(customer.dateOfBirth).toLocaleDateString('en-GH') : '—'], ['Nationality', customer.nationality], ['Occupation', customer.occupation], ['Source of Funds', customer.sourceOfFunds]].map(([l, v]) => (
            <div key={l}><dt className="text-slate-500">{l}</dt><dd className="font-medium">{v||'—'}</dd></div>
          ))}
        </dl>
        <div className="mt-3 flex gap-2">
          {customer.pepFlag && <span className="badge-red">PEP Flagged</span>}
          {customer.sanctionsFlag && <span className="badge-red">Sanctions Flagged</span>}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="font-semibold flex items-center gap-2"><ShieldCheck size={16} className="text-blue-600"/>KYC Decision</h3></div>
        <div className="card-body">
          <form onSubmit={handleSubmit(d => mutation.mutate(d))} className="space-y-4">
            <div className="form-group">
              <label className="label">Decision</label>
              <select {...register('status')} className="input">
                <option value="approved">Approve</option>
                <option value="rejected">Reject</option>
                <option value="in_review">Request More Info</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">KYC Tier</label>
              <select {...register('tier')} className="input">
                <option value="tier_1">Tier 1 — Basic ID</option>
                <option value="tier_2">Tier 2 — ID + Utility Bill</option>
                <option value="tier_3">Tier 3 — Full CDD</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Notes / Reason</label>
              <textarea {...register('notes')} rows={3} className="input" placeholder="Add review notes..."/>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => navigate(-1)} className="btn-secondary flex-1">Cancel</button>
              <button type="submit" disabled={mutation.isPending} className="btn-primary flex-1">Submit Decision</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
