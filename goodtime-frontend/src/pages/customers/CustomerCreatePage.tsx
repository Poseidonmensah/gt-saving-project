import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';
import toast from 'react-hot-toast';

const schema = z.object({
  fullName: z.string().min(2, 'Full name required'),
  phoneNumber: z.string().min(10, 'Valid phone required'),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  nationality: z.string().optional(),
  idType: z.string().optional(),
  idNumber: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().optional(),
  region: z.string().optional(),
  occupation: z.string().optional(),
  employerName: z.string().optional(),
  sourceOfFunds: z.string().optional(),
  branchId: z.string().min(1, 'Branch required'),
});

type Form = z.infer<typeof schema>;

const REGIONS = ['Greater Accra','Ashanti','Western','Central','Eastern','Volta','Northern','Upper East','Upper West','Bono','Ahafo','Bono East','Oti','Savannah','North East','Western North'];
const ID_TYPES = ['ghana_card','passport','voters_id','drivers_license','nhis'];

export function CustomerCreatePage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({
    resolver: zodResolver(schema),
    defaultValues: { branchId: user?.branchId || '', nationality: 'Ghanaian' },
  });

  const onSubmit = async (data: Form) => {
    try {
      const customer = await apiFetch('/customers', { method: 'POST', body: JSON.stringify(data) });
      toast.success(`Customer ${customer.customerNumber} created`);
      navigate(`/customers/${customer.customerId}`);
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div className="max-w-3xl">
      <div className="page-header">
        <div><h1 className="page-title">New Customer</h1><p className="page-subtitle">Register a new customer record</p></div>
        <button onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Personal Information</h3></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div className="col-span-2 form-group">
              <label className="label">Full Name *</label>
              <input {...register('fullName')} className={`input ${errors.fullName?'input-error':''}`} placeholder="Enter full legal name"/>
              {errors.fullName && <p className="form-error">{errors.fullName.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Phone Number *</label>
              <input {...register('phoneNumber')} className={`input ${errors.phoneNumber?'input-error':''}`} placeholder="0244000000"/>
              {errors.phoneNumber && <p className="form-error">{errors.phoneNumber.message}</p>}
            </div>
            <div className="form-group">
              <label className="label">Date of Birth</label>
              <input {...register('dateOfBirth')} type="date" className="input"/>
            </div>
            <div className="form-group">
              <label className="label">Gender</label>
              <select {...register('gender')} className="input">
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div className="form-group">
              <label className="label">Nationality</label>
              <input {...register('nationality')} className="input" defaultValue="Ghanaian"/>
            </div>
            <div className="form-group">
              <label className="label">Email</label>
              <input {...register('email')} type="email" className="input" placeholder="optional@email.com"/>
            </div>
            <div className="form-group">
              <label className="label">Region</label>
              <select {...register('region')} className="input">
                <option value="">Select region</option>
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Residential Address</label>
              <input {...register('address')} className="input" placeholder="House number, street, area"/>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Identity Document</h3></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">ID Type</label>
              <select {...register('idType')} className="input">
                <option value="">Select</option>
                {ID_TYPES.map(t => <option key={t} value={t}>{t.replace(/_/g,' ').toUpperCase()}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="label">ID Number</label>
              <input {...register('idNumber')} className="input" placeholder="GHA-000000000-0"/>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Employment & Source of Funds</h3></div>
          <div className="card-body grid grid-cols-2 gap-4">
            <div className="form-group">
              <label className="label">Occupation</label>
              <input {...register('occupation')} className="input" placeholder="e.g. Teacher, Trader"/>
            </div>
            <div className="form-group">
              <label className="label">Employer Name</label>
              <input {...register('employerName')} className="input" placeholder="Company / Business name"/>
            </div>
            <div className="col-span-2 form-group">
              <label className="label">Source of Funds</label>
              <input {...register('sourceOfFunds')} className="input" placeholder="e.g. Salary, Business income, Remittances"/>
            </div>
          </div>
        </div>

        <div className="flex gap-3 justify-end">
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary">Cancel</button>
          <button type="submit" disabled={isSubmitting} className="btn-primary px-8">
            {isSubmitting ? 'Creating...' : 'Create Customer'}
          </button>
        </div>
      </form>
    </div>
  );
}
