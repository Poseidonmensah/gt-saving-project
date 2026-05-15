import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore } from '@store/auth.store';
import { apiFetch } from '@hooks/useApi';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'Minimum 8 characters'),
  confirmPassword: z.string(),
}).refine(d => d.newPassword === d.confirmPassword, { message: 'Passwords do not match', path: ['confirmPassword'] });

export function ChangePasswordPage() {
  const navigate = useNavigate();
  const { updateUser } = useAuthStore();
  const [show, setShow] = useState(false);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data: any) => {
    try {
      await apiFetch('/auth/change-password', { method: 'PATCH', body: JSON.stringify({ currentPassword: data.currentPassword, newPassword: data.newPassword }) });
      toast.success('Password changed successfully');
      updateUser({ mustChangePassword: false });
      navigate('/dashboard');
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <Lock size={20} className="text-amber-500" />
        <div>
          <h2 className="text-xl font-bold text-slate-900">Change Password</h2>
          <p className="text-sm text-slate-500">You must change your password before continuing</p>
        </div>
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {(['currentPassword','newPassword','confirmPassword'] as const).map((field, i) => (
          <div key={field} className="form-group">
            <label className="label">{['Current Password','New Password','Confirm New Password'][i]}</label>
            <div className="relative">
              <input {...register(field)} type={show ? 'text' : 'password'} className={`input pr-10 ${errors[field] ? 'input-error' : ''}`} />
              {i === 1 && <button type="button" onClick={() => setShow(s => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">{show ? <EyeOff size={15}/> : <Eye size={15}/>}</button>}
            </div>
            {errors[field] && <p className="form-error">{String(errors[field]?.message)}</p>}
          </div>
        ))}
        <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700 space-y-1">
          <p className="font-medium">Password requirements:</p>
          <p>• Minimum 8 characters</p>
          <p>• Must differ from current password</p>
        </div>
        <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-2.5">
          {isSubmitting ? 'Saving...' : 'Set New Password'}
        </button>
      </form>
    </div>
  );
}
