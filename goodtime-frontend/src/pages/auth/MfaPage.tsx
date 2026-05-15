import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '@store/auth.store';
import { Shield } from 'lucide-react';
import toast from 'react-hot-toast';

export function MfaPage() {
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const { partialToken, setAuth } = useAuthStore();
  const navigate = useNavigate();

  const verify = async () => {
    if (token.length !== 6) return;
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mfaToken: token, partialToken }),
      }).then(r => r.json());
      if (res.data?.accessToken) {
        setAuth(res.data.user, res.data.accessToken, res.data.refreshToken);
        navigate('/dashboard');
      } else {
        toast.error(res.message || 'Invalid MFA token');
      }
    } catch { toast.error('Verification failed'); }
    finally { setLoading(false); }
  };

  return (
    <div className="text-center">
      <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <Shield size={28} className="text-blue-600" />
      </div>
      <h2 className="text-xl font-bold text-slate-900 mb-1">Two-Factor Authentication</h2>
      <p className="text-slate-500 text-sm mb-6">Enter the 6-digit code from your authenticator app</p>
      <input
        type="text" maxLength={6} value={token}
        onChange={e => { setToken(e.target.value.replace(/\D/,'')); }}
        className="input text-center text-2xl font-mono tracking-widest mb-4"
        placeholder="000000" autoFocus
      />
      <button onClick={verify} disabled={loading || token.length!==6} className="btn-primary w-full py-2.5">
        {loading ? 'Verifying...' : 'Verify'}
      </button>
      <button onClick={() => navigate('/login')} className="btn-ghost w-full mt-2 text-sm">Back to login</button>
    </div>
  );
}
