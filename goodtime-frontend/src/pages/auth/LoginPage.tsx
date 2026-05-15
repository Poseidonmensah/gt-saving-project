import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Eye, EyeOff, Lock, User, Shield, AlertTriangle } from 'lucide-react';
import { useAuthStore } from '@store/auth.store';

const schema = z.object({
  username:  z.string().min(1, 'Username is required'),
  password:  z.string().min(1, 'Password is required'),
  mfaToken:  z.string().optional(),
});
type Form = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const { setAuth, setPartialToken } = useAuthStore();
  const [showPassword, setShowPassword] = useState(false);
  const [needsMfa, setNeedsMfa] = useState(false);
  const [loading, setLoading] = useState(false);
  const attempts = useRef(0);

  const { register, handleSubmit, formState: { errors }, setError } = useForm<Form>({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data: Form) => {
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then(r => r.json());

      if (res.mfaRequired) {
        setPartialToken(res.partialToken);
        setNeedsMfa(true);
        toast('Enter your authenticator code');
        return;
      }

      if (res.data?.accessToken) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        toast.success(`Welcome back, ${res.data.user.fullName}!`);
        navigate(res.data.user.mustChangePassword ? '/change-password' : '/dashboard');
      } else {
        attempts.current += 1;
        const msg = res.message || 'Invalid credentials';
        setError('password', { message: msg });
        toast.error(msg);
      }
    } catch {
      toast.error('Login failed. Check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Sign in</h2>
      <p className="text-slate-500 text-sm mb-6">Access the Good Time S&L Management System</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="form-group">
          <label className="label">Username or Email</label>
          <div className="relative">
            <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input {...register('username')} className={`input pl-9 ${errors.username ? 'input-error' : ''}`} placeholder="Enter username" autoFocus autoComplete="username"/>
          </div>
          {errors.username && <p className="form-error">{errors.username.message}</p>}
        </div>

        <div className="form-group">
          <label className="label">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
            <input
              {...register('password')}
              type={showPassword ? 'text' : 'password'}
              className={`input pl-9 pr-10 ${errors.password ? 'input-error' : ''}`}
              placeholder="Enter password"
              autoComplete="current-password"
            />
            <button type="button" onClick={() => setShowPassword(s => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              {showPassword ? <EyeOff size={16}/> : <Eye size={16}/>}
            </button>
          </div>
          {errors.password && <p className="form-error">{errors.password.message}</p>}
        </div>

        {needsMfa && (
          <div className="form-group">
            <label className="label">
              <Shield size={14} className="inline mr-1 text-blue-600"/>
              MFA Token (6-digit authenticator code)
            </label>
            <input {...register('mfaToken')} className="input text-center tracking-widest text-lg font-mono"
              placeholder="000000" maxLength={6} autoFocus inputMode="numeric"/>
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full py-2.5 mt-2">
          {loading
            ? <span className="flex items-center justify-center gap-2"><svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Signing in…</span>
            : needsMfa ? 'Verify & Sign In' : 'Sign In'
          }
        </button>
      </form>

      <div className="mt-5 p-3 bg-amber-50 rounded-lg border border-amber-200 flex gap-2">
        <AlertTriangle size={15} className="text-amber-600 flex-shrink-0 mt-0.5"/>
        <p className="text-xs text-amber-700">All access is logged and monitored. Unauthorised access is prohibited.</p>
      </div>
    </div>
  );
}
