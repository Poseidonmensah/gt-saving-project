import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { reconApi } from '@api/index';
import { useAuthStore } from '@store/auth.store';
import { CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export function CashReconciliationPage() {
  const { user } = useAuthStore();
  const [sessionId, setSessionId] = useState('');
  const [physCount, setPhysCount] = useState('');
  const [result, setResult] = useState<any>(null);

  const startSession = useMutation({
    mutationFn: () => reconApi.startSession({ type: 'cash', branchId: user?.branchId || '' }),
    onSuccess: (d: any) => { setSessionId(d.sessionId); toast.success('Reconciliation session started'); },
    onError: (e: any) => toast.error(e.message),
  });

  const reconcile = useMutation({
    mutationFn: () => reconApi.reconcileCash(sessionId, String(Math.round(parseFloat(physCount) * 100))),
    onSuccess: (d: any) => { setResult(d); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="max-w-xl mx-auto space-y-5">
      <div className="page-header"><div><h1 className="page-title">Cash Reconciliation</h1><p className="page-subtitle">Reconcile teller cash drawer against GL</p></div></div>

      {!sessionId ? (
        <div className="card p-6 text-center space-y-4">
          <p className="text-slate-600">Start a new cash reconciliation session for today.</p>
          <button onClick={() => startSession.mutate()} disabled={startSession.isPending} className="btn-primary px-8">
            {startSession.isPending ? 'Starting…' : 'Start Cash Reconciliation'}
          </button>
        </div>
      ) : result ? (
        <div className={`card p-6 text-center ${result.balanced ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex justify-center mb-4">
            {result.balanced ? <CheckCircle size={48} className="text-emerald-600"/> : <XCircle size={48} className="text-red-600"/>}
          </div>
          <h2 className="text-xl font-bold mb-4">{result.balanced ? 'Cash Balanced!' : 'Cash Variance Detected'}</h2>
          <div className="space-y-2 text-sm mb-4">
            {[['System Balance (GL)', `GHS ${(Number(result.systemBalance)/100).toFixed(2)}`], ['Physical Count', `GHS ${(Number(result.physicalCount)/100).toFixed(2)}`], ['Variance', `GHS ${(Number(result.variance)/100).toFixed(2)}`]].map(([l,v]) => (
              <div key={l} className="flex justify-between"><span className="text-slate-600">{l}</span><strong>{v}</strong></div>
            ))}
          </div>
          {!result.balanced && <p className="text-red-600 text-sm">Variance has been logged. Please investigate and resolve exceptions.</p>}
          <button onClick={() => { setResult(null); setSessionId(''); setPhysCount(''); }} className="btn-secondary mt-4">New Session</button>
        </div>
      ) : (
        <div className="card">
          <div className="card-header"><h3 className="font-semibold">Enter Physical Cash Count</h3></div>
          <div className="card-body space-y-4">
            <p className="text-sm text-slate-500">Session ID: <code className="font-mono">{sessionId.slice(0,8)}…</code></p>
            <div className="form-group">
              <label className="label">Physical Cash Count (GHS)</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">GHS</span>
                <input type="number" step="0.01" value={physCount} onChange={e => setPhysCount(e.target.value)} className="input pl-12 font-mono text-lg" placeholder="0.00"/>
              </div>
            </div>
            <button onClick={() => reconcile.mutate()} disabled={!physCount || reconcile.isPending} className="btn-primary w-full py-3">
              {reconcile.isPending ? 'Reconciling…' : 'Run Reconciliation'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
